import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { SettingsPage } from '@/components/settings/settings-page';

export const metadata: Metadata = { title: 'Settings & privacy' };

export default function Settings() {
  return (
    <>
      <PageHeader eyebrow="Your control" title="Settings & privacy" description="Decide who sees what, how we reach you, and what happens to your data." />
      <Suspense><SettingsPage /></Suspense>
    </>
  );
}
