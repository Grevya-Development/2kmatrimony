import type { Metadata } from 'next';
import { SupportThread } from '@/components/support/member-support';

export const metadata: Metadata = { title: 'Support request' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupportThread id={id} />;
}
