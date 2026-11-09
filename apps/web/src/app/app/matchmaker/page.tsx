import { ActiveProfileGate } from '@/components/shell/profile-gate';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { MatchmakerChat } from '@/components/ai/matchmaker-chat';

export const metadata: Metadata = { title: 'Personal matchmaker' };

export default function MatchmakerPage() {
  return (
    <ActiveProfileGate>
      <PageHeader eyebrow="AI-curated discovery" title="Your personal matchmaker" description="Share what matters to you in your own words. Review every filter before it’s applied — you stay in control." />
      <MatchmakerChat />
    </ActiveProfileGate>
  );
}
