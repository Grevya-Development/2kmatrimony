'use client';
import * as React from 'react';
import { toast } from 'sonner';
import type { ConsentState, ConsentType, DeviceItem, NotificationCategory, NotificationChannel, OwnProfileResponse } from '@2k/shared';
import { setAnalyticsConsent } from '@/lib/analytics';
import { api, ApiClientError } from '@/lib/api';
import { Badge, Button, Card, CardContent, EmptyState, ErrorState, Notice, Skeleton, Switch } from '@/components/ui';
import { PrivacyForm } from '@/components/profile-edit/privacy-form';
import { Laptop, Smartphone } from 'lucide-react';

function useLoad<T>(path: string) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(async () => { try { setError(null); setData(await api<T>(path)); } catch (e) { setError((e as ApiClientError).message); } }, [path]);
  React.useEffect(() => { void load(); }, [load]);
  return { data, setData, error, load };
}

export function PrivacyTab() {
  const { data, error, load } = useLoad<OwnProfileResponse>('/profile');
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Skeleton className="h-96" />;
  return <Card><CardContent><PrivacyForm initial={data.form.privacy} onSaved={() => toast.success('Privacy settings saved')} /></CardContent></Card>;
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  interests: 'Interests', connections: 'New connections', messages: 'Messages', recommendations: 'New matches', verification: 'Verification',
  billing: 'Billing', family: 'Family', product_updates: 'Product updates', security: 'Security',
};
const CHANNEL_LABELS: Record<NotificationChannel, string> = { in_app: 'In app', email: 'Email', push: 'Push', sms: 'SMS', whatsapp: 'WhatsApp' };
type Pref = { category: NotificationCategory; channel: NotificationChannel; enabled: boolean; locked: boolean };

export function NotificationsTab() {
  const { data, setData, error, load } = useLoad<Pref[]>('/settings/notifications');
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Skeleton className="h-96" />;
  const channels = Object.keys(CHANNEL_LABELS) as NotificationChannel[];
  const categories = [...new Set(data.map((p) => p.category))];
  const get = (c: NotificationCategory, ch: NotificationChannel) => data.find((p) => p.category === c && p.channel === ch)!;
  const toggle = (c: NotificationCategory, ch: NotificationChannel, on: boolean) => { setData(data.map((p) => (p.category === c && p.channel === ch ? { ...p, enabled: on } : p))); setDirty(true); };
  const save = async () => {
    setSaving(true);
    try { setData(await api<Pref[]>('/settings/notifications', { method: 'PUT', body: { preferences: data.filter((p) => !p.locked).map(({ category, channel, enabled }) => ({ category, channel, enabled })) } })); setDirty(false); toast.success('Notification preferences saved'); }
    catch (e) { toast.error((e as ApiClientError).message); } finally { setSaving(false); }
  };
  return (
    <Card><CardContent className="space-y-5">
      <div><h2 className="font-serif text-2xl">Notifications</h2><p className="text-sm text-muted">Choose how we reach you. WhatsApp and SMS are only used where available and permitted.</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="text-left text-muted"><th className="py-2 font-medium">Notify me about</th>{channels.map((ch) => <th key={ch} className="px-2 py-2 text-center font-medium">{CHANNEL_LABELS[ch]}</th>)}</tr></thead>
          <tbody>{categories.map((c) => (
            <tr key={c} className="border-t border-line"><th scope="row" className="py-3 text-left font-normal text-ink">{CATEGORY_LABELS[c]}</th>
              {channels.map((ch) => { const p = get(c, ch); return (
                <td key={ch} className="px-2 py-3 text-center"><Switch checked={p.enabled} disabled={p.locked} onCheckedChange={(on) => toggle(c, ch, on)} aria-label={`${CATEGORY_LABELS[c]} by ${CHANNEL_LABELS[ch]}`} /></td>
              ); })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <Button onClick={save} loading={saving} disabled={!dirty}>Save preferences</Button>
    </CardContent></Card>
  );
}

const CONSENT_COPY: Record<ConsentType, { title: string; body: string }> = {
  terms: { title: 'Terms of Service', body: 'Required to use 2K Marriage.' },
  privacy: { title: 'Privacy Policy', body: 'Required. Explains how we handle your data under India’s DPDP Act.' },
  ai_processing: { title: 'AI assistance', body: 'Lets AI use your profile answers to personalise matches, explanations and suggestions. AI never reads private messages.' },
  ai_message_analysis: { title: 'AI conversation insights', body: 'Allows specific features to analyse conversations you choose. Off unless you turn it on.' },
  family_access: { title: 'Family collaboration', body: 'Lets family members you invite see the parts of your profile and matches you permit.' },
  marketing_email: { title: 'Marketing emails', body: 'Occasional updates and offers by email.' },
  marketing_sms: { title: 'Marketing SMS', body: 'Occasional offers by SMS.' },
  whatsapp: { title: 'WhatsApp updates', body: 'Receive notifications on WhatsApp where available.' },
  identity_verification: { title: 'Identity verification processing', body: 'Allows our team or a compliant provider to process documents you submit for verification.' },
  data_sharing_partner: { title: 'Partner offers', body: 'Share limited data with vetted partners for offers you request.' },
  product_analytics: { title: 'Product analytics', body: 'Helps us improve 2K Marriage with anonymous usage data (pages visited, features used). Never your name, contact details, profile text or messages.' },
};

export function ConsentsTab() {
  const { data, setData, error, load } = useLoad<ConsentState[]>('/settings/consents');
  const [busy, setBusy] = React.useState<string | null>(null);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Skeleton className="h-96" />;
  const set = async (t: ConsentType, granted: boolean) => {
    setBusy(t);
    try { setData(await api<ConsentState[]>('/settings/consents', { body: { consentType: t, granted } })); if (t === 'product_analytics') setAnalyticsConsent(granted); toast.success(granted ? 'Consent granted' : 'Consent withdrawn'); }
    catch (e) { toast.error((e as ApiClientError).message); } finally { setBusy(null); }
  };
  return (
    <Card><CardContent className="space-y-2">
      <h2 className="font-serif text-2xl">Consents</h2>
      <p className="pb-2 text-sm text-muted">You can withdraw optional consents at any time. Each change is recorded with the policy version you agreed to.</p>
      <ul className="divide-y divide-line">{data.map((c) => (
        <li key={c.consentType} className="flex items-start justify-between gap-6 py-4">
          <div><p className="flex items-center gap-2 font-medium">{CONSENT_COPY[c.consentType].title}{c.required && <Badge tone="outline">Required</Badge>}</p>
            <p className="text-sm text-muted">{CONSENT_COPY[c.consentType].body}</p>
            {c.updatedAt && <p className="mt-1 text-xs text-muted">{c.granted ? 'Granted' : 'Withdrawn'} {new Date(c.updatedAt).toLocaleDateString('en-IN')}{c.policyVersion ? ` · version ${c.policyVersion}` : ''}</p>}
            {c.required && <p className="mt-1 text-xs text-muted">To withdraw this, delete your account from the Data tab.</p>}</div>
          <Switch checked={c.granted} disabled={c.required || busy === c.consentType} onCheckedChange={(on) => set(c.consentType, on)} aria-label={CONSENT_COPY[c.consentType].title} />
        </li>
      ))}</ul>
    </CardContent></Card>
  );
}

export function DevicesTab() {
  const { data, error, load } = useLoad<DeviceItem[]>('/devices');
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Skeleton className="h-64" />;
  const revoke = async (id: string) => {
    try { await api(`/devices/${id}`, { method: 'DELETE' }); toast.success('Device removed'); await load(); } catch (e) { toast.error((e as ApiClientError).message); }
  };
  return (
    <Card><CardContent className="space-y-4">
      <div><h2 className="font-serif text-2xl">Devices</h2><p className="text-sm text-muted">Phones and browsers registered for notifications. Removing a device stops its notifications; use “Sign out all devices” in Account to end sessions.</p></div>
      {data.length === 0 ? <EmptyState title="No registered devices" description="Devices appear here after you sign in on the mobile app and allow notifications." /> : (
        <ul className="divide-y divide-line">{data.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink-2">{d.platform === 'web' ? <Laptop className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}</span>
              <div><p className="font-medium">{d.deviceName ?? (d.platform === 'web' ? 'Web browser' : d.platform === 'ios' ? 'iPhone' : 'Android phone')}</p>
                <p className="text-xs text-muted">Last active {new Date(d.lastSeenAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}{d.hasPush ? ' · notifications on' : ''}{d.appVersion ? ` · v${d.appVersion}` : ''}</p></div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => revoke(d.id)}>Remove</Button>
          </li>
        ))}</ul>
      )}
      <Notice>Don’t recognise a device? Remove it, then sign out all devices from the Account tab.</Notice>
    </CardContent></Card>
  );
}
