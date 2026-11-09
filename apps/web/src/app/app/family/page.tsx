import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { FamilyOwnerView } from '@/components/family/owner-view';

export const metadata: Metadata = { title: 'Family' };

export default function FamilyPage() {
  return (
    <>
      <PageHeader eyebrow="Family collaboration" title="Search together, decide yourself" description="Invite the people you trust to review suggestions, shortlist and share their thoughts — with exactly the access you choose." />
      <FamilyOwnerView />
    </>
  );
}
