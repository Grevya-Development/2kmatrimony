import PostHog from 'posthog-react-native';
import { Platform } from 'react-native';
import { sanitizeAnalyticsProps, scrubString, type AnalyticsEvent } from '@2k/shared';
import { config } from './config';

/**
 * Mobile product analytics (PostHog), privacy-first:
 *  - disabled unless EXPO_PUBLIC_POSTHOG_KEY is set
 *  - the client is only created after the member opts in (consent recorded
 *    server-side), so there is no PostHog traffic at all before consent
 *  - no autocapture of touches, no session replay
 *  - pseudonymous identity (user id only); screen names have ids scrubbed
 */
let client: PostHog | null = null;

export const analyticsConfigured = (): boolean => config.posthogKey.length > 0;

/** The running client, or null until consent has been granted. */
export function getAnalytics(): PostHog | null {
  return client;
}

function start(): PostHog | null {
  if (!analyticsConfigured()) return null;
  if (!client) {
    client = new PostHog(config.posthogKey, {
      host: config.posthogHost,
      defaultOptIn: false,
      captureAppLifecycleEvents: true,
      enableSessionReplay: false,
      personProfiles: 'identified_only',
      preloadFeatureFlags: false, // we use our own feature flags
      disableRemoteConfig: true,
      disableSurveys: true,
    });
  }
  return client;
}

export async function setAnalyticsConsent(granted: boolean): Promise<void> {
  if (granted) {
    await start()?.optIn();
  } else if (client) {
    await client.optOut();
    client.reset();
  }
}

export function identifyMember(userId: string, props: Record<string, unknown>): void {
  const ph = getAnalytics();
  if (!ph || ph.optedOut) return;
  ph.identify(userId, sanitizeAnalyticsProps({ ...props, platform: Platform.OS }));
}

export function trackScreen(pathname: string): void {
  const ph = getAnalytics();
  if (!ph || ph.optedOut) return;
  void ph.screen(scrubString(pathname));
}

export function captureEvent(event: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  const ph = getAnalytics();
  if (!ph || ph.optedOut) return;
  ph.capture(event, sanitizeAnalyticsProps({ ...props, platform: Platform.OS }));
}

export function resetAnalytics(): void {
  getAnalytics()?.reset();
}
