/**
 * Product analytics contract shared by web, mobile and server.
 * Privacy rules (DPDP): events are pseudonymous (distinct id = internal user id),
 * never carry names, contact details, profile text or message content, and are
 * only sent to PostHog after the member/visitor opts in ('product_analytics').
 */

export const ANALYTICS_EVENTS = [
  'signed_up',
  'onboarding_step_completed',
  'profile_activated',
  'recommendations_viewed',
  'profile_viewed',
  'search_performed',
  'smart_search_used',
  'matchmaker_message_sent',
  'interest_sent',
  'interest_responded',
  'connection_created',
  'message_sent',
  'insight_generated',
  'checkout_started',
  'subscription_activated',
  'family_invite_sent',
  'verification_submitted',
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsProps = Record<string, string | number | boolean | null>;

/** Keys that must never leave the app, at any depth of naming. */
const FORBIDDEN_KEY = /(^|_)(email|phone|mobile|name|first_name|last_name|about|bio|body|message|text|query|note|address|gstin|dob|date_of_birth|religion|community|income|token|password|otp)($|_)/i;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s-]{8,}\d/g;

/** Replace ids, emails and phone numbers inside a string (URLs, paths, referrers). */
export function scrubString(value: string): string {
  return value.replace(UUID, ':id').replace(EMAIL, '[email]').replace(PHONE, '[phone]');
}

/** Drop forbidden keys and scrub string values. Non-primitive values are removed. */
export function sanitizeAnalyticsProps(props: Record<string, unknown> | null | undefined): AnalyticsProps {
  const out: AnalyticsProps = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (FORBIDDEN_KEY.test(key)) continue;
    if (typeof value === 'string') out[key] = scrubString(value).slice(0, 200);
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) out[key] = value;
  }
  return out;
}

/** PostHog's own URL properties that need scrubbing on every client event. */
export const POSTHOG_URL_PROPS = ['$current_url', '$pathname', '$referrer', '$initial_referrer', '$initial_current_url', '$prev_pageview_pathname', '$screen_name'] as const;

export const ANALYTICS_CONSENT_STORAGE_KEY = 'tk_analytics_consent';
