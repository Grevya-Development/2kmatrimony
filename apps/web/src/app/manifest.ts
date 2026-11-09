import type { MetadataRoute } from 'next';

/** PWA manifest — icons from the Brand DNA kit (06_App_Icons/Web_PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '2K Marriage',
    short_name: '2K Marriage',
    description: 'Tradition Meets AI — thoughtful, mutual, privacy-first matchmaking.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#fefaf4',
    theme_color: '#013833',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
