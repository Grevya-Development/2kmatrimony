import { permanentRedirect } from 'next/navigation';

/** 2K Matrimony is free; the old pricing page permanently redirects home. */
export default function PricingPage(): never {
  permanentRedirect('/');
}
