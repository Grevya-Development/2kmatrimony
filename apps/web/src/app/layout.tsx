import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Toaster } from 'sonner';
import './globals.css';

// Brand fonts from the Brand DNA kit (SIL Open Font License): Newsreader for
// heritage (wordmark & headings), Montserrat for clarity (UI & body).
const display = localFont({ src: './fonts/Newsreader-Variable.woff2', weight: '200 800', variable: '--font-display', display: 'swap' });
const ui = localFont({ src: './fonts/Montserrat-Variable.woff2', weight: '100 900', variable: '--font-ui', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: { default: '2K Matrimony — More Than a Match. A Meaningful Beginning.', template: '%s · 2K Matrimony' },
  description: 'Discover someone who aligns with your values, ambitions, lifestyle and vision of the future. Thoughtful, mutual, privacy-first matchmaking.',
  applicationName: '2K Matrimony',
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: '2K Matrimony',
    title: '2K Matrimony — Tradition Meets AI',
    description: 'Discover someone who aligns with your values, ambitions, lifestyle and vision of the future.',
    images: [{ url: '/brand/og-card.png', width: 1924, height: 776, alt: '2K Matrimony — Tradition Meets AI' }],
  },
  twitter: { card: 'summary_large_image', images: ['/brand/og-card.png'] },
};

export const viewport: Viewport = { themeColor: '#033b39', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas">Skip to content</a>
        {children}
        <Toaster position="top-center" toastOptions={{ classNames: { toast: 'rounded-2xl border border-line bg-surface text-ink shadow-lift font-sans' } }} />
      </body>
    </html>
  );
}
