import type { Metadata } from 'next';
import MarketplacePageClient from '@/components/marketplace/MarketplacePageClient';
import {
  getMarketplaceListingProductsPayloadPage,
  MARKETPLACE_DEFAULT_PAGE_SIZE,
} from '@/lib/listings';
import { getProductHref } from '@/lib/product-url';
import { getSiteUrl } from '@/lib/site';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Rent, Buy, and Sell Near You',
  description:
    'Discover nearby rentals and products for sale with fresh local listings updated daily.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Rent, Buy, and Sell Near You',
    description:
      'Discover nearby rentals and products for sale with fresh local listings updated daily.',
    type: 'website',
    url: '/',
  },
};

export default async function HomePage() {
  const siteUrl = getSiteUrl();
  const firstPage = await getMarketplaceListingProductsPayloadPage({
    limit: MARKETPLACE_DEFAULT_PAGE_SIZE,
  });
  const { products, nextCursor, hasMore } = firstPage;

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Marketplace Listings',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.title,
      url: `${siteUrl}${getProductHref(product)}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <MarketplacePageClient
        initialProducts={products}
        initialNextCursor={nextCursor}
        initialHasMore={hasMore}
      />
    </>
  );
}
