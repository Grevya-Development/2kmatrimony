import { Suspense } from 'react';
import type { Metadata } from 'next';
import { OwnProfile } from '@/components/profile-edit/own-profile';

export const metadata: Metadata = { title: 'My profile' };

export default function MyProfilePage() {
  return <Suspense><OwnProfile /></Suspense>;
}
