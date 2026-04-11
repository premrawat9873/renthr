import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/auth/',
          '/api/chat/',
          '/api/profile/',
          '/api/wishlist/',
          '/api/addresses/',
          '/api/images/upload',
          '/api/videos/upload',
          '/my-posts',
        ],
      },
      {
        userAgent: '*',
        allow: [
          '/api/listings',
          '/api/listings/',
          '/api/locations/india',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
