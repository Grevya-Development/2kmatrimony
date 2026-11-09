import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Discover } from '@/components/discovery/discover';

export const metadata: Metadata = { title: 'Discover' };

export default function DiscoverPage() {
  return <Suspense><Discover /></Suspense>;
}
