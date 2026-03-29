import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailClient from '@/components/marketplace/ProductDetailClient';
import { formatPrice } from '@/data/marketplaceData';
import { getListingProductPayloadById } from '@/lib/listings';
import { getSiteUrl, SITE_NAME } from '@/lib/site';

type ProductPageParams = { id: string };

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<ProductPageParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getListingProductPayloadById(id);

  if (!product) {
    return {
      title: 'Product Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const hasSellPrice =
    (product.type === 'sell' || product.type === 'both') && product.price != null;

  const baseDescription =
    product.description ??
    `${product.title} is available in ${product.location} for ${
      hasSellPrice
        ? formatPrice(product.price)
        : product.type === 'both'
          ? 'rent or sale'
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
  const product = await getListingProductPayloadById(id);

  if (!product) {
    notFound();
  }

  const siteUrl = getSiteUrl();
  const productUrl = `${siteUrl}/product/${product.id}`;
  const hasSellPrice =
    (product.type === 'sell' || product.type === 'both') && product.price != null;
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
    ...(hasSellPrice
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
      <ProductDetailClient product={product} />
    </>
  );
}
