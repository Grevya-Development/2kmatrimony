import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-display', display: 'swap' });
const ui = Inter({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: { default: '2K Matrimony — More Than a Match. A Meaningful Beginning.', template: '%s · 2K Matrimony' },
  description: 'Discover someone who aligns with your values, ambitions, lifestyle and vision of the future. Thoughtful, mutual, privacy-first matchmaking.',
  applicationName: '2K Matrimony',
};

export const viewport: Viewport = { themeColor: '#faf7f2', width: 'device-width', initialScale: 1 };

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
