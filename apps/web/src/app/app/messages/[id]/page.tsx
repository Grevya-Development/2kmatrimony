import type { Metadata } from 'next';
import { Thread } from '@/components/messaging/thread';

export const metadata: Metadata = { title: 'Conversation' };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Thread key={id} conversationId={id} />;
}
