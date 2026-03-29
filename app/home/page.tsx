import type { Metadata } from 'next';
import MarketplacePageClient from '@/components/marketplace/MarketplacePageClient';
import { MOCK_PRODUCTS } from '@/data/mockData';
import { getSiteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Rent, Buy, and Sell Near You',
  description:
    'Discover nearby rentals and products for sale with fresh local listings updated daily.',
  alternates: {
    canonical: '/home',
  },
  openGraph: {
    title: 'Rent, Buy, and Sell Near You',
    description:
      'Discover nearby rentals and products for sale with fresh local listings updated daily.',
    type: 'website',
    url: '/home',
  },
};

export default function HomePage() {
  const siteUrl = getSiteUrl();
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Marketplace Listings',
    itemListElement: MOCK_PRODUCTS.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.title,
        url: `${siteUrl}/product/${product.id}`,
        image: product.image,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <MarketplacePageClient />
    </>
  );
}