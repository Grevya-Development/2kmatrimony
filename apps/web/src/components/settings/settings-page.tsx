'use client';
import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { AccountTab } from './account-tab';
import { ConsentsTab, DevicesTab, NotificationsTab, PrivacyTab } from './preferences-tabs';
import { DataTab } from './data-tab';

const TABS = [
  { key: 'account', label: 'Account' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'consents', label: 'Consents' },
  { key: 'devices', label: 'Devices' },
  { key: 'data', label: 'Data' },
] as const;

export function SettingsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab')! : 'account';
  const [tab, setTab] = React.useState(initial);
  const change = (t: string) => { setTab(t); router.replace(`/app/settings?tab=${t}`, { scroll: false }); };
  return (
    <Tabs value={tab} onValueChange={change}>
      <div className="-mx-4 overflow-x-auto px-4 scrollbar-none"><TabsList>{TABS.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}</TabsList></div>
      <div className="max-w-3xl">
        <TabsContent value="account"><AccountTab /></TabsContent>
        <TabsContent value="privacy"><PrivacyTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
        <TabsContent value="consents"><ConsentsTab /></TabsContent>
        <TabsContent value="devices"><DevicesTab /></TabsContent>
        <TabsContent value="data"><DataTab /></TabsContent>
      </div>
    </Tabs>
  );
}
