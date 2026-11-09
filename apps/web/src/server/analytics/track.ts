import 'server-only';
import { after } from 'next/server';
import { PostHog } from 'posthog-node';
import { sanitizeAnalyticsProps, type AnalyticsEvent, type Json } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { integrations, publicEnv } from '@/lib/env';
import { isEnabled } from '@/server/config';

/**
 * Server-side product analytics.
 *  1. Always: a minimal, pseudonymous first-party row in analytics_events
 *     (powers the admin analytics dashboards; sanitised, no PII).
 *  2. Only when PostHog is configured, the `product_analytics` flag is on AND
 *     the member opted in: the same event is sent to PostHog.
 * Never throws — analytics must not break product flows.
 */

let client: PostHog | null = null;
function posthog(): PostHog | null {
  if (!integrations.posthog) return null;
  if (!client) client = new PostHog(publicEnv.posthogKey, { host: publicEnv.posthogHost, flushAt: 1, flushInterval: 0 });
  return client;
}

const CONSENT_TTL = 60_000;
const consentCache = new Map<string, { at: number; granted: boolean }>();

export async function hasAnalyticsConsent(userId: string): Promise<boolean> {
  const hit = consentCache.get(userId);
  if (hit && Date.now() - hit.at < CONSENT_TTL) return hit.granted;
  const { data } = await db().from('current_consents').select('granted').eq('user_id', userId).eq('consent_type', 'product_analytics').maybeSingle();
  const granted = data?.granted === true;
  consentCache.set(userId, { at: Date.now(), granted });
  return granted;
}

/** Call when a member changes their analytics consent so it applies immediately. */
export function forgetAnalyticsConsent(userId: string): void {
  consentCache.delete(userId);
}

export function track(
  userId: string | null,
  event: AnalyticsEvent,
  props: Record<string, unknown> = {},
  platform: 'web' | 'ios' | 'android' | 'server' = 'server',
): void {
  const properties = sanitizeAnalyticsProps(props);
  // Runs after the response is sent (Next `after`), so it never delays the user
  // and is not dropped by serverless runtimes.
  runAfterResponse(async () => {
    try {
      const { error } = await db().from('analytics_events').insert({ user_id: userId, event, properties: properties as NonNullable<Json>, platform });
      if (error) console.error('[analytics] first-party insert failed', error.message);
    } catch (err) {
      console.error('[analytics] first-party insert failed', err);
    }
    const ph = posthog();
    if (!ph || !userId) return;
    try {
      if (!(await isEnabled('product_analytics'))) return;
      if (!(await hasAnalyticsConsent(userId))) return;
      ph.capture({ distinctId: userId, event, properties: { ...properties, platform } });
      await ph.flush();
    } catch (err) {
      console.error('[analytics] posthog capture failed', err);
    }
  });
}

/** Defer non-critical work until after the response (falls back outside a request). */
function runAfterResponse(fn: () => Promise<void>): void {
  try {
    after(fn);
  } catch {
    void fn();
  }
}
