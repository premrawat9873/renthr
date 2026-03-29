import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailClient from '@/components/marketplace/ProductDetailClient';
import { MOCK_PRODUCTS } from '@/data/mockData';
import { formatPrice } from '@/data/marketplaceData';
import { getSiteUrl, SITE_NAME } from '@/lib/site';

type ProductPageParams = { id: string };

export function generateStaticParams(): ProductPageParams[] {
  return MOCK_PRODUCTS.map((product) => ({ id: product.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<ProductPageParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = MOCK_PRODUCTS.find((item) => item.id === id);

  if (!product) {
    return {
      title: 'Product Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const baseDescription =
    product.description ??
    `${product.title} is available in ${product.location} for ${
      product.type === 'sell' && product.price != null
        ? formatPrice(product.price)
        : 'rental'
    }.`;

  return {
    title: product.title,
    description: baseDescription,
    alternates: {
      canonical: `/product/${product.id}`,
    },
    openGraph: {
      title: product.title,
      description: baseDescription,
      type: 'website',
      url: `/product/${product.id}`,
      images: product.image
        ? [
            {
              url: product.image,
              alt: product.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.title,
      description: baseDescription,
      images: product.image ? [product.image] : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<ProductPageParams>;
}) {
  const { id } = await params;
  const product = MOCK_PRODUCTS.find((item) => item.id === id);

  if (!product) {
    notFound();
  }

  const siteUrl = getSiteUrl();
  const productUrl = `${siteUrl}/product/${product.id}`;
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    sku: product.id,
    category: product.category,
    description:
      product.description ?? `${product.title} listing in ${product.location}.`,
    image: product.images.length > 0 ? product.images : [product.image],
    url: productUrl,
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
    },
    ...(product.type === 'sell' && product.price != null
      ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: product.price,
            itemCondition: 'https://schema.org/UsedCondition',
            availability: 'https://schema.org/InStock',
            url: productUrl,
          },
        }
      : {}),
    ...(product.rating != null && product.reviewCount != null
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <ProductDetailClient id={id} />
    </>
  );
}
