'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CATEGORIES } from '@/data/mockData';
import { deserializeListingProduct, type ListingProductPayload } from '@/data/listings';
import type { ListingFilter, RentDuration, SortOption } from '@/data/marketplaceData';
import ProductGrid from '@/components/marketplace/ProductGrid';
import { Slider } from '@/components/ui/slider';

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

type SearchSubcategory = {
  id: string;
  label: string;
  keywords: string[];
};

const SEARCH_SUBCATEGORIES: Record<string, SearchSubcategory[]> = {
  electronics: [
    { id: 'electronics:phone', label: 'Phone', keywords: ['phone', 'iphone', 'android', 'mobile'] },
    { id: 'electronics:tablet', label: 'Tablet', keywords: ['tablet', 'ipad'] },
    { id: 'electronics:laptop', label: 'Laptop', keywords: ['laptop', 'notebook', 'macbook'] },
    { id: 'electronics:pc', label: 'PC', keywords: ['desktop', 'pc', 'computer'] },
  ],
  furniture: [
    { id: 'furniture:chair', label: 'Chair', keywords: ['chair', 'stool'] },
    { id: 'furniture:bed', label: 'Bed', keywords: ['bed', 'mattress', 'cot'] },
    { id: 'furniture:sofa', label: 'Sofa', keywords: ['sofa', 'couch'] },
    { id: 'furniture:table', label: 'Table', keywords: ['table', 'desk', 'dining'] },
  ],
  vehicles: [
    { id: 'vehicles:car', label: 'Car', keywords: ['car', 'sedan', 'suv', 'hatchback'] },
    { id: 'vehicles:bike', label: 'Bike', keywords: ['bike', 'motorcycle'] },
    { id: 'vehicles:cycle', label: 'Cycle', keywords: ['cycle', 'bicycle'] },
    { id: 'vehicles:scooter', label: 'Scooter', keywords: ['scooter'] },
  ],
  flat: [
    { id: 'flat:1bhk', label: '1BHK', keywords: ['1bhk', 'one bhk'] },
    { id: 'flat:2bhk', label: '2BHK', keywords: ['2bhk', 'two bhk'] },
    { id: 'flat:3bhk', label: '3BHK+', keywords: ['3bhk', '4bhk', 'penthouse'] },
  ],
  pg: [
    { id: 'pg:boys', label: 'Boys', keywords: ['boys', 'male pg', 'gents'] },
    { id: 'pg:girls', label: 'Girls', keywords: ['girls', 'female pg', 'ladies'] },
    { id: 'pg:shared', label: 'Shared', keywords: ['shared', 'double sharing', 'triple sharing'] },
    { id: 'pg:private', label: 'Private', keywords: ['private', 'single room'] },
  ],
};

const SUBCATEGORY_LOOKUP = new Map(
  Object.values(SEARCH_SUBCATEGORIES).flatMap((list) =>
    list.map((subcategory) => [subcategory.id, subcategory] as const)
  )
);

function matchesSubcategories(
  product: ReturnType<typeof deserializeListingProduct>,
  selectedSubcategories: string[]
) {
  if (selectedSubcategories.length === 0) {
    return true;
  }

  const text = `${product.title} ${product.category} ${product.description || ''}`.toLowerCase();

  return selectedSubcategories.some((subcategoryId) => {
    const subcategory = SUBCATEGORY_LOOKUP.get(subcategoryId);
    if (!subcategory) {
      return false;
    }

    return subcategory.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  });
}

export default function SearchPageClient({ initialQuery = '' }: SearchPageClientProps) {
  const initialNormalizedQuery = initialQuery.trim();

  const [query, setQuery] = useState(initialNormalizedQuery);
  const [locationQuery, setLocationQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState(initialNormalizedQuery);
  const [committedLocation, setCommittedLocation] = useState('');
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(initialNormalizedQuery.length > 0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [filter, setFilter] = useState<ListingFilter>('all');
  const [sort, setSort] = useState<SortOption>('newest');

  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [draftFilter, setDraftFilter] = useState<ListingFilter>('all');
  const [draftSort, setDraftSort] = useState<SortOption>('newest');
  const [draftSelectedCategories, setDraftSelectedCategories] = useState<string[]>([]);
  const [draftSelectedSubcategories, setDraftSelectedSubcategories] = useState<string[]>([]);
  const [draftMinPrice, setDraftMinPrice] = useState(0);
  const [draftMaxPrice, setDraftMaxPrice] = useState(MAX_PRICE);
  const [draftMinPriceInput, setDraftMinPriceInput] = useState('0');
  const [draftMaxPriceInput, setDraftMaxPriceInput] = useState(String(MAX_PRICE));

  const [items, setItems] = useState<ListingProductPayload[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isRefreshingResults, setIsRefreshingResults] = useState(initialNormalizedQuery.length > 0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      const normalizedQuery = committedQuery.trim();
      if (normalizedQuery) {
        params.set('q', normalizedQuery);
      }

      const normalizedLocation = committedLocation.trim();
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
    [committedLocation, committedQuery, filter, maxPrice, minPrice, selectedCategories, sort]
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
    if (!hasSubmittedSearch || !committedQuery.trim()) {
      return;
    }

    void fetchPage(null, false);
  }, [
    categoriesSignature,
    committedLocation,
    committedQuery,
    fetchPage,
    filter,
    hasSubmittedSearch,
    maxPrice,
    minPrice,
    sort,
  ]);

  const loadMore = useCallback(() => {
    if (!hasSubmittedSearch || !hasMore || !nextCursor || isLoadingMore || isRefreshingResults) {
      return;
    }

    void fetchPage(nextCursor, true);
  }, [fetchPage, hasMore, hasSubmittedSearch, isLoadingMore, isRefreshingResults, nextCursor]);

  const visibleProducts = useMemo(
    () =>
      items
        .map((item) => deserializeListingProduct(item))
        .filter((product) => matchesSubcategories(product, selectedSubcategories)),
    [items, selectedSubcategories]
  );

  const toggleDraftCategory = useCallback((categoryId: string) => {
    setDraftSelectedCategories((current) => {
      if (current.includes(categoryId)) {
        setDraftSelectedSubcategories((subcategories) =>
          subcategories.filter((subcategoryId) => !subcategoryId.startsWith(`${categoryId}:`))
        );
        return current.filter((item) => item !== categoryId);
      }

      return [...current, categoryId];
    });
  }, []);

  const toggleDraftSubcategory = useCallback((subcategoryId: string) => {
    setDraftSelectedSubcategories((current) => {
      if (current.includes(subcategoryId)) {
        return current.filter((item) => item !== subcategoryId);
      }

      return [...current, subcategoryId];
    });
  }, []);

  const visibleDraftSubcategories = useMemo(
    () =>
      draftSelectedCategories.flatMap((categoryId) => SEARCH_SUBCATEGORIES[categoryId] ?? []),
    [draftSelectedCategories]
  );

  const handleFilterDialogChange = useCallback(
    (nextOpen: boolean) => {
      setIsFilterDialogOpen(nextOpen);

      if (!nextOpen) {
        return;
      }

      setDraftFilter(filter);
      setDraftSort(sort);
      setDraftSelectedCategories(selectedCategories);
      setDraftSelectedSubcategories(selectedSubcategories);
      setDraftMinPrice(minPrice);
      setDraftMaxPrice(maxPrice);
      setDraftMinPriceInput(String(minPrice));
      setDraftMaxPriceInput(String(maxPrice));
    },
    [
      filter,
      maxPrice,
      minPrice,
      selectedCategories,
      selectedSubcategories,
      sort,
    ]
  );

  const applyDraftMinPriceFromInput = useCallback(() => {
    const parsed = parsePriceInput(draftMinPriceInput, draftMinPrice);
    const nextMin = Math.min(parsed, draftMaxPrice);
    setDraftMinPrice(nextMin);
    setDraftMinPriceInput(String(nextMin));
  }, [draftMaxPrice, draftMinPrice, draftMinPriceInput]);

  const applyDraftMaxPriceFromInput = useCallback(() => {
    const parsed = parsePriceInput(draftMaxPriceInput, draftMaxPrice);
    const nextMax = Math.max(parsed, draftMinPrice);
    setDraftMaxPrice(nextMax);
    setDraftMaxPriceInput(String(nextMax));
  }, [draftMaxPrice, draftMaxPriceInput, draftMinPrice]);

  const resetDraftFilters = useCallback(() => {
    setDraftFilter('all');
    setDraftSort('newest');
    setDraftSelectedCategories([]);
    setDraftSelectedSubcategories([]);
    setDraftMinPrice(0);
    setDraftMaxPrice(MAX_PRICE);
    setDraftMinPriceInput('0');
    setDraftMaxPriceInput(String(MAX_PRICE));
  }, []);

  const applyDraftFilters = useCallback(() => {
    setFilter(draftFilter);
    setSort(draftSort);
    setSelectedCategories(draftSelectedCategories);
    setSelectedSubcategories(draftSelectedSubcategories);
    setMinPrice(draftMinPrice);
    setMaxPrice(draftMaxPrice);
    setIsFilterDialogOpen(false);
  }, [
    draftFilter,
    draftMaxPrice,
    draftMinPrice,
    draftSelectedCategories,
    draftSelectedSubcategories,
    draftSort,
  ]);

  const submitSearch = useCallback(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setCommittedQuery('');
      setCommittedLocation('');
      setHasSubmittedSearch(false);
      setItems([]);
      setNextCursor(null);
      setHasMore(false);
      setErrorMessage(null);
      return;
    }

    setCommittedQuery(normalizedQuery);
    setCommittedLocation(locationQuery.trim());
    setHasSubmittedSearch(true);
  }, [locationQuery, query]);

  const clearAllFilters = useCallback(() => {
    setQuery('');
    setLocationQuery('');
    setCommittedQuery('');
    setCommittedLocation('');
    setHasSubmittedSearch(false);
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setFilter('all');
    setSort('newest');
    setMinPrice(0);
    setMaxPrice(MAX_PRICE);
    setDraftFilter('all');
    setDraftSort('newest');
    setDraftSelectedCategories([]);
    setDraftSelectedSubcategories([]);
    setDraftMinPrice(0);
    setDraftMaxPrice(MAX_PRICE);
    setDraftMinPriceInput('0');
    setDraftMaxPriceInput(String(MAX_PRICE));
    setIsFilterDialogOpen(false);
    setItems([]);
    setNextCursor(null);
    setHasMore(false);
    setErrorMessage(null);
  }, []);

  const resultCountLabel =
    !hasSubmittedSearch
      ? 'Search to see products'
      : visibleProducts.length === 1
        ? '1 result'
        : `${visibleProducts.length} results`;

  const activeFilterCount = useMemo(() => {
    let count = 0;

    if (filter !== 'all') {
      count += 1;
    }

    if (sort !== 'newest') {
      count += 1;
    }

    if (selectedCategories.length > 0) {
      count += 1;
    }

    if (selectedSubcategories.length > 0) {
      count += 1;
    }

    if (minPrice > 0 || maxPrice < MAX_PRICE) {
      count += 1;
    }

    return count;
  }, [filter, maxPrice, minPrice, selectedCategories.length, selectedSubcategories.length, sort]);

  return (
    <main className="bg-background text-foreground">
      <div className="container py-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Link>
          </Button>

          <button
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-primary hover:underline"
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>

        <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-[0_12px_30px_-26px_hsl(var(--foreground)/0.55)] sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
            <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitSearch();
                  }
                }}
                placeholder="Search products, brands, keywords"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <input
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitSearch();
                  }
                }}
                placeholder="City or area"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>

            <Button
              type="button"
              variant="highlight"
              onClick={submitSearch}
              className="h-11 rounded-xl px-4"
            >
              <Search className="mr-1.5 h-4 w-4" />
              Search
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Dialog open={isFilterDialogOpen} onOpenChange={handleFilterDialogChange}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="h-10 rounded-xl px-3">
                  <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 ? (
                    <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Apply filters</DialogTitle>
                  <DialogDescription>
                    Pick category, price, listing type, and sort. Results update when you tap Apply.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">Listing Type</p>
                    <div className="flex flex-wrap gap-2">
                      {(['all', 'rent', 'sell'] as ListingFilter[]).map((option) => {
                        const active = draftFilter === option;
                        return (
                          <button
                            key={option}
                            onClick={() => setDraftFilter(option)}
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
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">Sort By</p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { value: 'newest', label: 'Newest' },
                        { value: 'distance', label: 'Nearest' },
                        { value: 'price-asc', label: 'Price Low' },
                        { value: 'price-desc', label: 'Price High' },
                      ] as Array<{ value: SortOption; label: string }>).map((option) => {
                        const active = draftSort === option.value;
                        return (
                          <button
                            key={option.value}
                            onClick={() => setDraftSort(option.value)}
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
                  </div>

                  <div className="rounded-xl border border-border/70 bg-background p-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">Price Range</p>
                      <p className="text-xs font-semibold text-primary">
                        ₹{draftMinPrice.toLocaleString('en-IN')} - ₹{draftMaxPrice.toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Min Price</span>
                        <input
                          value={draftMinPriceInput}
                          onChange={(event) => setDraftMinPriceInput(event.target.value)}
                          onBlur={applyDraftMinPriceFromInput}
                          inputMode="numeric"
                          placeholder="0"
                          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none transition-colors focus:border-primary/45"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Max Price</span>
                        <input
                          value={draftMaxPriceInput}
                          onChange={(event) => setDraftMaxPriceInput(event.target.value)}
                          onBlur={applyDraftMaxPriceFromInput}
                          inputMode="numeric"
                          placeholder={String(MAX_PRICE)}
                          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none transition-colors focus:border-primary/45"
                        />
                      </label>
                    </div>

                    <div className="mt-3 space-y-2">
                      <Slider
                        min={0}
                        max={MAX_PRICE}
                        step={1000}
                        value={[draftMinPrice, draftMaxPrice]}
                        onValueChange={(values) => {
                          if (!Array.isArray(values) || values.length < 2) {
                            return;
                          }

                          const [nextMin, nextMax] = values;
                          setDraftMinPrice(nextMin);
                          setDraftMaxPrice(nextMax);
                          setDraftMinPriceInput(String(nextMin));
                          setDraftMaxPriceInput(String(nextMax));
                        }}
                        className="py-1"
                        aria-label="Price range"
                      />
                      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                        <span>Drag left for min</span>
                        <span>right for max</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-foreground">Categories</p>
                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {CATEGORIES.map((category) => {
                        const active = draftSelectedCategories.includes(category.id);
                        return (
                          <button
                            key={category.id}
                            onClick={() => toggleDraftCategory(category.id)}
                            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                              active
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                            }`}
                          >
                            <span aria-hidden="true">{category.icon}</span>
                            <span>{category.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {visibleDraftSubcategories.length > 0 ? (
                      <>
                        <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Subcategories
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {visibleDraftSubcategories.map((subcategory) => {
                            const active = draftSelectedSubcategories.includes(subcategory.id);
                            return (
                              <button
                                key={subcategory.id}
                                onClick={() => toggleDraftSubcategory(subcategory.id)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                  active
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                }`}
                              >
                                {subcategory.label}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={resetDraftFilters}>
                    Reset
                  </Button>
                  <Button type="button" variant="highlight" onClick={applyDraftFilters}>
                    Apply Filters
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <p className="text-xs font-medium text-muted-foreground">
              {activeFilterCount > 0
                ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} applied`
                : 'No filters applied'}
            </p>
          </div>
        </section>

        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">{resultCountLabel}</h2>
            {hasSubmittedSearch && isRefreshingResults ? (
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

          {!hasSubmittedSearch ? (
            <div className="mb-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
              Type a keyword and press Search to load products.
            </div>
          ) : null}

          <ProductGrid
            products={visibleProducts}
            listingFilter={filter}
            rentDurations={[] as RentDuration[]}
            hasMore={hasSubmittedSearch ? hasMore : false}
            isLoadingMore={isLoadingMore}
            isRefreshingResults={hasSubmittedSearch ? isRefreshingResults : false}
            onLoadMore={loadMore}
          />
        </section>
      </div>
    </main>
  );
}
