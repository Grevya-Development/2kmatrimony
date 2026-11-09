import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { VerificationCenter } from '@/components/verification/verification-center';

export const metadata: Metadata = { title: 'Verification' };

export default function VerificationPage() {
  return (
    <>
      <PageHeader eyebrow="Trust" title="Verification" description="Build trust with clear, specific checks. Verification is optional, private and reviewed by people." />
      <VerificationCenter />
    </>
  );
}
