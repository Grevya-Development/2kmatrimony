import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:56321';
const supabaseHost = new URL(supabaseUrl);

const isDev = process.env.NODE_ENV !== 'production';
const supabaseOrigin = supabaseHost.origin;
const supabaseWs = supabaseOrigin.replace(/^http/, 'ws');

/**
 * Content-Security-Policy. Next's inline bootstrap needs 'unsafe-inline' for
 * scripts (no nonces); styles need it for Tailwind/motion. External origins are
 * limited to Supabase (API, storage, realtime) and Razorpay Checkout.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  `media-src 'self' blob: ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs} https://*.razorpay.com`,
  'frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com',
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Only when everything is served over HTTPS (local `next start` uses http).
  ...(!isDev && supabaseHost.protocol === 'https:' && (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https:') ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  transpilePackages: ['@2k/shared', '@2k/matching'],
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: supabaseHost.protocol.replace(':', '') as 'http' | 'https', hostname: supabaseHost.hostname, port: supabaseHost.port, pathname: '/storage/v1/**' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
