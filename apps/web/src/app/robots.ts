import type { MetadataRoute } from 'next';

/** Member and admin areas are never indexed; profiles are not public. */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return {
    rules: [{ userAgent: '*', allow: ['/', '/legal/'], disallow: ['/app', '/admin', '/api', '/onboarding', '/auth'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
