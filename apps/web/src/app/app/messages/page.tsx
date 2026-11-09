import type { Metadata } from 'next';
import { MessagesSquare } from 'lucide-react';
import { EmptyState } from '@/components/ui';

export const metadata: Metadata = { title: 'Messages' };

export default function MessagesIndex() {
  return <EmptyState icon={<MessagesSquare />} title="Choose a conversation" description="Your conversations with connections appear on the left. AI may suggest conversation starters, but it never writes messages for you." className="h-full min-h-[60dvh]" />;
}
