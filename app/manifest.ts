import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RentHour',
    short_name: 'RentHour',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#5b8f00',
    icons: [
      {
        src: '/favicon-48.png?v=20260412',
        sizes: '48x48',
        type: 'image/png',
      },
      {
        src: '/favicon-192.png?v=20260412',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png?v=20260412',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
