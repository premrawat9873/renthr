'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, MapPin, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CATEGORIES } from '@/data/mockData';
import { deserializeListingProduct, type ListingProductPayload } from '@/data/listings';
import type { ListingFilter, RentDuration, SortOption } from '@/data/marketplaceData';
import ProductGrid from '@/components/marketplace/ProductGrid';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const MAX_PRICE = 200000;
const SEARCH_PAGE_SIZE = 12;

type SearchPageClientProps = {
  initialQuery?: string;
};

type ListingsPageResponse = {
  products?: ListingProductPayload[];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: string;
};

function parsePriceInput(value: string, fallback: number) {
  const digitsOnly = value.replace(/\D/g, '');
  if (!digitsOnly) {
    return fallback;
  }

  const parsed = Number.parseInt(digitsOnly, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(MAX_PRICE, parsed));
}

function normalizeCategoryList(value: string[]) {
  return Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));
}

function mergePayloadProducts(
  existing: ListingProductPayload[],
  incoming: ListingProductPayload[]
) {
  if (incoming.length === 0) {
    return existing;
  }

  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];

  for (const item of incoming) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  return merged;
}

export default function SearchPageClient({ initialQuery = '' }: SearchPageClientProps) {
  const [query, setQuery] = useState(initialQuery);
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState<ListingFilter>('all');
  const [sort, setSort] = useState<SortOption>('newest');

  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [minPriceInput, setMinPriceInput] = useState('0');
  const [maxPriceInput, setMaxPriceInput] = useState(String(MAX_PRICE));

  const [items, setItems] = useState<ListingProductPayload[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isRefreshingResults, setIsRefreshingResults] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query, 300);
  const debouncedLocation = useDebouncedValue(locationQuery, 300);
  const categoriesSignature = useMemo(
    () => selectedCategories.slice().sort().join('|'),
    [selectedCategories]
  );

  const buildSearchParams = useCallback(
    (cursor: string | null = null) => {
      const params = new URLSearchParams();
      params.set('limit', String(SEARCH_PAGE_SIZE));

      if (cursor) {
        params.set('cursor', cursor);
      }

      const normalizedQuery = debouncedQuery.trim();
      if (normalizedQuery) {
        params.set('q', normalizedQuery);
      }

      const normalizedLocation = debouncedLocation.trim();
      if (normalizedLocation) {
        params.set('location', normalizedLocation);
      }

      const normalizedCategories = normalizeCategoryList(selectedCategories);
      if (normalizedCategories.length > 0) {
        params.set('categories', normalizedCategories.join(','));
      }

      if (filter !== 'all') {
        params.set('filter', filter);
      }

      if (sort !== 'newest') {
        params.set('sort', sort);
      }

      if (minPrice > 0) {
        params.set('minPrice', String(minPrice));
      }

      if (maxPrice < MAX_PRICE) {
        params.set('maxPrice', String(maxPrice));
      }

      return params;
    },
    [debouncedLocation, debouncedQuery, filter, maxPrice, minPrice, selectedCategories, sort]
  );

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsRefreshingResults(true);
      }

      try {
        setErrorMessage(null);
        const response = await fetch(`/api/listings?${buildSearchParams(cursor).toString()}`, {
          cache: 'no-store',
        });

        const payload = (await response
          .json()
          .catch(() => null)) as ListingsPageResponse | null;

        if (!response.ok || !payload || !Array.isArray(payload.products)) {
          throw new Error(payload?.error || 'Unable to load search results right now.');
        }

        setItems((current) =>
          append ? mergePayloadProducts(current, payload.products ?? []) : payload.products ?? []
        );
        setNextCursor(typeof payload.nextCursor === 'string' ? payload.nextCursor : null);
        setHasMore(Boolean(payload.hasMore));
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load search results right now.'
        );

        if (!append) {
          setItems([]);
          setNextCursor(null);
          setHasMore(false);
        }
      } finally {
        if (append) {
          setIsLoadingMore(false);
        } else {
          setIsRefreshingResults(false);
        }
      }
    },
    [buildSearchParams]
  );

  useEffect(() => {
    void fetchPage(null, false);
  }, [categoriesSignature, debouncedLocation, debouncedQuery, fetchPage, filter, maxPrice, minPrice, sort]);

  const loadMore = useCallback(() => {
    if (!hasMore || !nextCursor || isLoadingMore || isRefreshingResults) {
      return;
    }

    void fetchPage(nextCursor, true);
  }, [fetchPage, hasMore, isLoadingMore, isRefreshingResults, nextCursor]);

  const visibleProducts = useMemo(
    () => items.map((item) => deserializeListingProduct(item)),
    [items]
  );

  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategories((current) => {
      if (current.includes(categoryId)) {
        return current.filter((item) => item !== categoryId);
      }

      return [...current, categoryId];
    });
  }, []);

  const applyMinPriceFromInput = useCallback(() => {
    const parsed = parsePriceInput(minPriceInput, minPrice);
    const nextMin = Math.min(parsed, maxPrice);
    setMinPrice(nextMin);
    setMinPriceInput(String(nextMin));
  }, [maxPrice, minPrice, minPriceInput]);

  const applyMaxPriceFromInput = useCallback(() => {
    const parsed = parsePriceInput(maxPriceInput, maxPrice);
    const nextMax = Math.max(parsed, minPrice);
    setMaxPrice(nextMax);
    setMaxPriceInput(String(nextMax));
  }, [maxPrice, maxPriceInput, minPrice]);

  const clearAllFilters = useCallback(() => {
    setQuery('');
    setLocationQuery('');
    setSelectedCategories([]);
    setFilter('all');
    setSort('newest');
    setMinPrice(0);
    setMaxPrice(MAX_PRICE);
    setMinPriceInput('0');
    setMaxPriceInput(String(MAX_PRICE));
  }, []);

  const resultCountLabel =
    visibleProducts.length === 1 ? '1 result' : `${visibleProducts.length} results`;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Link>
          </Button>

          <p className="text-sm font-semibold tracking-wide text-muted-foreground">Search Marketplace</p>

          <button
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-primary hover:underline"
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-[0_12px_30px_-26px_hsl(var(--foreground)/0.55)] sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
            <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products, brands, keywords"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <input
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
                placeholder="City or area"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(['all', 'rent', 'sell'] as ListingFilter[]).map((option) => {
              const active = filter === option;
              return (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {option === 'all' ? 'All' : option}
                </button>
              );
            })}

            {([
              { value: 'newest', label: 'Newest' },
              { value: 'distance', label: 'Nearest' },
              { value: 'price-asc', label: 'Price Low' },
              { value: 'price-desc', label: 'Price High' },
            ] as Array<{ value: SortOption; label: string }>).map((option) => {
              const active = sort === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setSort(option.value)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-border/70 bg-background p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Price Range</p>
              <p className="text-xs font-semibold text-primary">
                ₹{minPrice.toLocaleString('en-IN')} - ₹{maxPrice.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Min Price</span>
                <input
                  value={minPriceInput}
                  onChange={(event) => setMinPriceInput(event.target.value)}
                  onBlur={applyMinPriceFromInput}
                  inputMode="numeric"
                  placeholder="0"
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none transition-colors focus:border-primary/45"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Max Price</span>
                <input
                  value={maxPriceInput}
                  onChange={(event) => setMaxPriceInput(event.target.value)}
                  onBlur={applyMaxPriceFromInput}
                  inputMode="numeric"
                  placeholder={String(MAX_PRICE)}
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none transition-colors focus:border-primary/45"
                />
              </label>
            </div>

            <div className="mt-3 space-y-2">
              <input
                type="range"
                min={0}
                max={MAX_PRICE}
                step={1000}
                value={minPrice}
                onChange={(event) => {
                  const nextMin = Math.min(Number(event.target.value), maxPrice);
                  setMinPrice(nextMin);
                  setMinPriceInput(String(nextMin));
                }}
                className="w-full accent-primary"
              />

              <input
                type="range"
                min={0}
                max={MAX_PRICE}
                step={1000}
                value={maxPrice}
                onChange={(event) => {
                  const nextMax = Math.max(Number(event.target.value), minPrice);
                  setMaxPrice(nextMax);
                  setMaxPriceInput(String(nextMax));
                }}
                className="w-full accent-primary"
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-foreground">Categories (multi-select)</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => {
                const active = selectedCategories.includes(category.id);
                return (
                  <button
                    key={category.id}
                    onClick={() => toggleCategory(category.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    <span aria-hidden="true">{active ? '☑' : '☐'}</span>
                    <span>{category.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">{resultCountLabel}</h2>
            {isRefreshingResults ? (
              <p className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Fetching results...
              </p>
            ) : null}
          </div>

          {errorMessage ? (
            <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <ProductGrid
            products={visibleProducts}
            listingFilter={filter}
            rentDurations={[] as RentDuration[]}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            isRefreshingResults={isRefreshingResults}
            onLoadMore={loadMore}
          />
        </section>
      </div>
    </main>
  );
}
