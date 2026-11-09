'use client';
import * as React from 'react';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui';
import { analyticsConfigured, getStoredConsent, initAnalytics, setAnalyticsConsent } from '@/lib/analytics';

const ConsentContext = React.createContext<{ decide: (granted: boolean) => void } | null>(null);

/** Records the decision for signed-in members (anonymous visitors get a 401, which is fine). */
async function recordConsent(granted: boolean): Promise<void> {
  try {
    await fetch('/api/v1/settings/consents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ consentType: 'product_analytics', granted }),
      credentials: 'same-origin',
    });
  } catch { /* offline — the local decision still applies */ }
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [askConsent, setAskConsent] = React.useState(false);

  React.useEffect(() => {
    if (!analyticsConfigured()) return;
    initAnalytics();
    setAskConsent(getStoredConsent() === null);
  }, []);

  const decide = React.useCallback((granted: boolean) => {
    setAnalyticsConsent(granted);
    setAskConsent(false);
    void recordConsent(granted);
  }, []);

  return (
    <ConsentContext.Provider value={{ decide }}>
      {children}
      {askConsent && <ConsentBanner onDecide={decide} />}
    </ConsentContext.Provider>
  );
}

function ConsentBanner({ onDecide }: { onDecide: (granted: boolean) => void }) {
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="analytics-consent-title"
      className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl border border-line bg-surface p-5 shadow-lift sm:bottom-6 sm:left-6 sm:right-auto md:bottom-6">
      <div className="flex gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-600"><BarChart3 className="h-4 w-4" aria-hidden /></span>
        <div className="space-y-3">
          <div>
            <p id="analytics-consent-title" className="font-medium text-ink">Help us improve 2K Matrimony?</p>
            <p className="mt-1 text-sm text-muted">With your permission we use anonymous usage analytics — pages visited and features used. Never your name, contact details, profile or messages. <Link href="/legal/privacy" className="underline underline-offset-2">Privacy policy</Link></p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onDecide(true)}>Allow</Button>
            <Button size="sm" variant="secondary" onClick={() => onDecide(false)}>No thanks</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
