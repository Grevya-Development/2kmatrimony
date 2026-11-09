import type { Metadata } from 'next';
import { ConnectionView } from '@/components/connection/connection-view';

export const metadata: Metadata = { title: 'Connection' };

export default async function ConnectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConnectionView connectionId={id} />;
}
