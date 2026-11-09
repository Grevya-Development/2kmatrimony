'use client';
import * as React from 'react';
import { useMe } from '@/components/shell/me-context';
import { analyticsConfigured, getStoredConsent, identifyMember, setAnalyticsConsent } from '@/lib/analytics';

/**
 * Inside the member app: the server-side consent record is the source of truth.
 * If the member decided on this device before signing in, persist that decision.
 * Identifies with the pseudonymous user id only when consent is granted.
 */
export function AnalyticsIdentity() {
  const { me } = useMe();
  React.useEffect(() => {
    if (!analyticsConfigured()) return;
    let granted = me.analyticsConsent;
    if (granted === null) {
      const local = getStoredConsent();
      if (local) {
        granted = local === 'granted';
        void fetch('/api/v1/settings/consents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ consentType: 'product_analytics', granted }), credentials: 'same-origin' }).catch(() => undefined);
      }
    }
    if (granted === null) return;
    setAnalyticsConsent(granted);
    if (granted) identifyMember(me.user.id, { plan: me.plan.code, platform: 'web', profile_status: me.profile?.status ?? 'none' });
  }, [me.analyticsConsent, me.user.id, me.plan.code, me.profile?.status]);
  return null;
}
