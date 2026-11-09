'use client';
import posthog from 'posthog-js';
import { ANALYTICS_CONSENT_STORAGE_KEY, POSTHOG_URL_PROPS, sanitizeAnalyticsProps, scrubString, type AnalyticsEvent } from '@2k/shared';

/**
 * Browser product analytics (PostHog), privacy-first:
 *  - off entirely unless NEXT_PUBLIC_POSTHOG_KEY is set
 *  - the SDK is not even loaded until the visitor/member opts in (DPDP): before
 *    consent there are zero requests to PostHog (no config/flags calls either)
 *  - no autocapture, no session recording, person profiles only once identified
 *  - first-party proxy (/ingest) so the CSP stays 'self'
 *  - ids, emails and phone numbers scrubbed from every URL property
 */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
let started = false;

export type ConsentDecision = 'granted' | 'denied' | null;

export const analyticsConfigured = (): boolean => KEY.length > 0;

export function getStoredConsent(): ConsentDecision {
  try {
    const v = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

function storeConsent(decision: 'granted' | 'denied'): void {
  try { window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, decision); } catch { /* storage unavailable */ }
}

/** Load PostHog only when consent is already granted on this device. */
export function initAnalytics(): void {
  if (getStoredConsent() === 'granted') start();
}

function start(): void {
  if (!KEY || started || typeof window === 'undefined') return;
  started = true;
  posthog.init(KEY, {
    api_host: '/ingest',
    ui_host: HOST.replace('.i.posthog.com', '.posthog.com'),
    capture_pageview: 'history_change',
    capture_pageleave: true,
    autocapture: false,
    disable_session_recording: true,
    disable_surveys: true,
    person_profiles: 'identified_only',
    opt_out_capturing_by_default: true,
    respect_dnt: true,
    persistence: 'localStorage+cookie',
    before_send: (event) => {
      if (!event) return null;
      const props = event.properties as Record<string, unknown>;
      for (const key of POSTHOG_URL_PROPS) {
        if (typeof props[key] === 'string') props[key] = scrubString(props[key] as string);
      }
      return event;
    },
  });
  posthog.opt_in_capturing();
}

/** Apply a consent decision locally (and remember it for this browser). */
export function setAnalyticsConsent(granted: boolean): void {
  storeConsent(granted ? 'granted' : 'denied');
  if (!KEY) return;
  if (granted) {
    start();
    posthog.opt_in_capturing();
  } else if (started) {
    posthog.opt_out_capturing();
    posthog.reset();
  }
}

/** Link events to the pseudonymous member id (never name/email/phone). */
export function identifyMember(userId: string, props: Record<string, unknown>): void {
  if (!KEY || !started || !posthog.has_opted_in_capturing()) return;
  posthog.identify(userId, sanitizeAnalyticsProps(props));
}

export function resetAnalytics(): void {
  if (KEY && started) posthog.reset();
}

export function captureClient(event: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  if (!KEY || !started || !posthog.has_opted_in_capturing()) return;
  posthog.capture(event, sanitizeAnalyticsProps(props));
}
