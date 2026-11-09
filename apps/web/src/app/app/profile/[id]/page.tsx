import type { Metadata } from 'next';
import { ProfileDetailView } from '@/components/profile/profile-detail-view';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfileDetailView id={id} />;
}
