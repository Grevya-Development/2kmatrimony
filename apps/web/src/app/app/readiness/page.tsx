import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { ReadinessView } from '@/components/readiness/readiness-view';

export const metadata: Metadata = { title: 'Marriage readiness' };

export default function ReadinessPage() {
  return (
    <>
      <PageHeader eyebrow="Private reflection" title="Before the big conversations" description="Explore important topics privately — finances, children, family, where to live — so you can discuss them openly with a prospective partner. Nobody else can see this." />
      <ReadinessView />
    </>
  );
}
