import type { MetadataRoute } from 'next';
import { MOCK_PRODUCTS } from '@/data/mockData';
import { getSiteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/home`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/product`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.2,
    },
  ];

  const productRoutes: MetadataRoute.Sitemap = MOCK_PRODUCTS.map((product) => ({
    url: `${siteUrl}/product/${product.id}`,
    lastModified: product.postedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
