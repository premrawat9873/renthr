import type { MetadataRoute } from 'next';
import { footerPageOrder, getFooterPagePath } from '@/lib/footer-pages';
import { getMarketplaceListingProductsPayload } from '@/lib/listings';
import { getProductHref } from '@/lib/product-url';
import { getSiteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const products = await getMarketplaceListingProductsPayload();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
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
    {
      url: `${siteUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/terms-of-use`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/sitemap`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  const footerRoutes: MetadataRoute.Sitemap = footerPageOrder.map((slug) => ({
    url: `${siteUrl}${getFooterPagePath(slug)}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.35,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${siteUrl}${getProductHref(product)}`,
    lastModified: new Date(product.postedAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...footerRoutes, ...productRoutes];
}
