import type { Metadata } from 'next';
import { ProfilesPage } from '@/components/admin/pages/profiles';

export const metadata: Metadata = { title: 'Profiles' };

export default function Page() {
  return <ProfilesPage />;
}
