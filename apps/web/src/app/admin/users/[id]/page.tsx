import type { Metadata } from 'next';
import { UserDetailPage } from '@/components/admin/pages/users';

export const metadata: Metadata = { title: 'User' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetailPage id={id} />;
}
