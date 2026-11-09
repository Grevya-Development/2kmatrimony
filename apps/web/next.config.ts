import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:56321';
const supabaseHost = new URL(supabaseUrl);

const securityHeaders = [
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
