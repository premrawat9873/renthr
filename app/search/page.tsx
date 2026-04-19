import type { Metadata } from 'next';

import SearchPageClient from '@/components/marketplace/SearchPageClient';

type SearchPageSearchParams = {
  q?: string;
};

export const revalidate = 0;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchPageSearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const rawQuery = typeof params.q === 'string' ? params.q.trim() : '';

  return {
    title: rawQuery ? `Search: ${rawQuery}` : 'Search Listings',
    description:
      'Search RentHour listings with keyword, multi-category, price range, and location filters.',
    alternates: {
      canonical: rawQuery
        ? `/search?q=${encodeURIComponent(rawQuery)}`
        : '/search',
    },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchPageSearchParams>;
}) {
  const params = await searchParams;
  const initialQuery = typeof params.q === 'string' ? params.q : '';

  return <SearchPageClient initialQuery={initialQuery} />;
}
