'use client';

import { useMemo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import CategorySection from '@/components/marketplace/CategorySection';
import FilterBar from '@/components/marketplace/FilterBar';
import ProductGrid from '@/components/marketplace/ProductGrid';
import {
  deserializeListingProduct,
  type ListingProductPayload,
} from '@/data/listings';
import type { RentDuration } from '@/data/marketplaceData';
import type { LocationData } from '@/components/marketplace/LocationSelector';
import { MapPin } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSupabaseAuth } from '@/lib/supabase-auth';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import {
  MAX_PRICE,
  clearFilters as clearMarketplaceFilters,
  selectHasActiveFilters,
  selectListingFilter,
  selectLocation,
  selectPriceRange,
  selectRentDurations,
  selectSearchQuery,
  selectSelectedCategories,
  selectSort,
  selectUserCoords,
  selectUserLocation,
  setFilter,
  setLocation,
  setPriceRange,
  setRentDurations,
  setSelectedCategories,
  setSort,
  setUserCoords,
  setUserLocation,
} from '@/store/slices/marketplaceSlice';
import { useWishlistBootstrap } from '@/hooks/use-wishlist';

const PAGE_SIZE = 8;
const subscribeHydration = () => () => {};
const EMPTY_CATEGORIES: string[] = [];
const EMPTY_DURATIONS: RentDuration[] = [];
const DEFAULT_PRICE_RANGE: [number, number] = [0, MAX_PRICE];
const MARKETPLACE_CACHE_STORAGE_KEY = 'renthour_marketplace_list_cache_v1';
const MARKETPLACE_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

type MarketplaceListCacheEntry = {
  queryKey: string;
  loadedProducts: ListingProductPayload[];
  nextCursor: string | null;
  hasMorePages: boolean;
  scrollY: number;
  savedAt: number;
};

const LOCATION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  koramangala: { lat: 12.9352, lng: 77.6245 },
  indiranagar: { lat: 12.9719, lng: 77.6412 },
  "hsr layout": { lat: 12.9116, lng: 77.6474 },
  whitefield: { lat: 12.9698, lng: 77.75 },
  "mg road": { lat: 12.9755, lng: 77.6067 },
  jayanagar: { lat: 12.9279, lng: 77.5938 },
  "btm layout": { lat: 12.9166, lng: 77.6101 },
  "electronic city": { lat: 12.8399, lng: 77.677 },
  marathahalli: { lat: 12.9591, lng: 77.6974 },
  hebbal: { lat: 13.0358, lng: 77.597 },
  "sarjapur road": { lat: 12.901, lng: 77.686 },
  delhi: { lat: 28.6139, lng: 77.209 },
  "new delhi": { lat: 28.6139, lng: 77.209 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  mohali: { lat: 30.7046, lng: 76.7179 },
  "sahibzada ajit singh nagar": { lat: 30.7046, lng: 76.7179 },
  gharuan: { lat: 30.8613, lng: 76.5206 },
  faridabad: { lat: 28.4089, lng: 77.3178 },
  noida: { lat: 28.5355, lng: 77.391 },
  gurgaon: { lat: 28.4595, lng: 77.0266 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  pune: { lat: 18.5204, lng: 73.8567 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
};

function normalizeLocationKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getLocationCandidates(rawLocation: string) {
  const normalized = rawLocation.trim();
  if (!normalized) {
    return [] as string[];
  }

  const segments = normalized
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const primary = segments[0] ?? normalized;
  return Array.from(new Set([normalized, primary]));
}

function getKnownCoordinates(rawLocation: string) {
  const candidates = getLocationCandidates(rawLocation);

  for (const candidate of candidates) {
    const match = LOCATION_COORDINATES[normalizeLocationKey(candidate)];
    if (match) {
      return match;
    }
  }

  return null;
}


type ReverseGeocodeResult = {
  city: string;
  state: string;
};

type LocationSearchSuggestion = {
  label: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

type LocationSearchResponse = {
  suggestions?: LocationSearchSuggestion[];
  error?: string;
};

async function searchLocationSuggestion(query: string) {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 2) {
    return null;
  }

  try {
    const response = await fetch(
      `/api/locations/search?q=${encodeURIComponent(normalizedQuery)}`,
      { cache: 'no-store' }
    );

    const payload = (await response
      .json()
      .catch(() => null)) as LocationSearchResponse | null;

    if (!response.ok || !payload || !Array.isArray(payload.suggestions)) {
      return null;
    }

    return payload.suggestions[0] ?? null;
  } catch {
    return null;
  }
}

async function reverseGeocodeLocation(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
      };
    };

    const city =
      data.address?.city ??
      data.address?.town ??
      data.address?.village ??
      data.address?.county ??
      "";
    const state = data.address?.state ?? "";

    if (!city && !state) {
      return null;
    }

    return {
      city: city || "Unknown",
      state: state || "Unknown",
    };
  } catch {
    return null;
  }
}

interface MarketplacePageClientProps {
  initialProducts: ListingProductPayload[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
}

type ListingsPageResponse = {
  products?: ListingProductPayload[];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: string;
};

function isValidMarketplaceListCacheEntry(value: unknown): value is MarketplaceListCacheEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MarketplaceListCacheEntry>;
  return (
    typeof candidate.queryKey === 'string' &&
    Array.isArray(candidate.loadedProducts) &&
    (typeof candidate.nextCursor === 'string' || candidate.nextCursor === null) &&
    typeof candidate.hasMorePages === 'boolean' &&
    typeof candidate.scrollY === 'number' &&
    Number.isFinite(candidate.scrollY) &&
    typeof candidate.savedAt === 'number' &&
    Number.isFinite(candidate.savedAt)
  );
}

function readMarketplaceListCache() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(MARKETPLACE_CACHE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isValidMarketplaceListCacheEntry(parsed)) {
      return null;
    }

    if (Date.now() - parsed.savedAt > MARKETPLACE_CACHE_MAX_AGE_MS) {
      window.sessionStorage.removeItem(MARKETPLACE_CACHE_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeMarketplaceListCache(entry: MarketplaceListCacheEntry) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(MARKETPLACE_CACHE_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore storage write failures.
  }
}

export function MarketplacePageClient({
  initialProducts,
  initialNextCursor,
  initialHasMore,
}: MarketplacePageClientProps) {
  useWishlistBootstrap();
  const { status } = useSupabaseAuth();
  const dispatch = useAppDispatch();
  const [loadedProducts, setLoadedProducts] = useState<ListingProductPayload[]>(initialProducts);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMorePages, setHasMorePages] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshingProducts, setIsRefreshingProducts] = useState(false);
  const [isApplyingListingQuery, setIsApplyingListingQuery] = useState(false);
  const [hasManualSortSelection, setHasManualSortSelection] = useState(false);
  const [hasBootstrappedCache, setHasBootstrappedCache] = useState(false);
  const listingRequestSequenceRef = useRef(0);
  const hasCompletedInitialRefreshRef = useRef(false);
  const hasRestoredFromCacheRef = useRef(false);
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const reduxAuthenticated = useAppSelector(selectIsAuthenticated);
  const location = useAppSelector(selectLocation);
  const userLocation = useAppSelector(selectUserLocation);
  const userCoords = useAppSelector(selectUserCoords);
  const searchQuery = useAppSelector(selectSearchQuery);
  const selectedCategories = useAppSelector(selectSelectedCategories);
  const filter = useAppSelector(selectListingFilter);
  const rentDurations = useAppSelector(selectRentDurations);
  const sort = useAppSelector(selectSort);
  const priceRange = useAppSelector(selectPriceRange);
  const hasActiveFilters = useAppSelector(selectHasActiveFilters);
  const isHydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const authReady = isHydrated && status !== 'loading';
  const isAuthenticated = authReady && (status === 'authenticated' || reduxAuthenticated);

  const safeLocation = isHydrated ? location : null;
  const safeUserLocation = isHydrated ? userLocation : null;
  const safeUserCoords = isHydrated ? userCoords : null;
  const safeSearchQuery = isHydrated ? searchQuery : '';
  const safeSelectedCategories = useMemo(
    () => (isHydrated ? selectedCategories : EMPTY_CATEGORIES),
    [isHydrated, selectedCategories]
  );
  const safeFilter = isHydrated ? filter : 'all';
  const safeRentDurations = isHydrated ? rentDurations : EMPTY_DURATIONS;
  const safeSort = isHydrated ? sort : 'distance';
  const safePriceRange: [number, number] = isHydrated ? priceRange : DEFAULT_PRICE_RANGE;
  const safeHasActiveFilters = isHydrated ? hasActiveFilters : false;
  const resolvedCoordsFromLocation = useMemo(() => {
    if (!safeLocation) {
      return null;
    }

    const knownCoords = getKnownCoordinates(safeLocation);
    if (!knownCoords) {
      return null;
    }

    return {
      latitude: knownCoords.lat,
      longitude: knownCoords.lng,
    };
  }, [safeLocation]);
  const effectiveUserCoords = safeUserCoords ?? resolvedCoordsFromLocation;
  const effectiveSort =
    isHydrated && isAuthenticated && !hasManualSortSelection && safeSort === 'newest'
      ? 'distance'
      : safeSort;
  const listingQuery = useMemo(
    () => ({
      searchQuery: safeSearchQuery.trim(),
      selectedCategories: [...safeSelectedCategories].sort(),
      filter: safeFilter,
      rentDurations: [...safeRentDurations].sort(),
      sort: effectiveSort,
      minPrice: safePriceRange[0],
      maxPrice: safePriceRange[1],
      latitude: effectiveUserCoords?.latitude ?? null,
      longitude: effectiveUserCoords?.longitude ?? null,
    }),
    [
      effectiveSort,
      effectiveUserCoords,
      safeFilter,
      safePriceRange,
      safeRentDurations,
      safeSearchQuery,
      safeSelectedCategories,
    ]
  );
  const listingQueryCacheKey = useMemo(
    () => JSON.stringify(listingQuery),
    [listingQuery]
  );

  const persistMarketplaceCache = useCallback(
    (scrollY?: number) => {
      const resolvedScrollY =
        typeof scrollY === 'number' && Number.isFinite(scrollY)
          ? Math.max(0, scrollY)
          : typeof window !== 'undefined'
            ? Math.max(0, window.scrollY)
            : 0;

      writeMarketplaceListCache({
        queryKey: listingQueryCacheKey,
        loadedProducts,
        nextCursor,
        hasMorePages,
        scrollY: resolvedScrollY,
        savedAt: Date.now(),
      });
    },
    [hasMorePages, listingQueryCacheKey, loadedProducts, nextCursor]
  );

  const buildListingsParams = useCallback(
    (cursor: string | null = null) => {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));

      if (cursor) {
        params.set('cursor', cursor);
      }

      if (listingQuery.searchQuery) {
        params.set('q', listingQuery.searchQuery);
      }

      if (listingQuery.selectedCategories.length > 0) {
        params.set('categories', listingQuery.selectedCategories.join(','));
      }

      if (listingQuery.filter !== 'all') {
        params.set('filter', listingQuery.filter);
      }

      if (listingQuery.rentDurations.length > 0) {
        params.set('rentDurations', listingQuery.rentDurations.join(','));
      }

      if (listingQuery.sort !== 'newest') {
        params.set('sort', listingQuery.sort);
      }

      if (listingQuery.minPrice > 0) {
        params.set('minPrice', String(listingQuery.minPrice));
      }

      if (listingQuery.maxPrice < MAX_PRICE) {
        params.set('maxPrice', String(listingQuery.maxPrice));
      }

      if (listingQuery.latitude != null && listingQuery.longitude != null) {
        params.set('latitude', String(listingQuery.latitude));
        params.set('longitude', String(listingQuery.longitude));
      }

      return params;
    },
    [listingQuery]
  );

  const availableProducts = useMemo(
    () => loadedProducts.map(deserializeListingProduct),
    [loadedProducts]
  );

  const fetchListingsPage = useCallback(
    async (cursor: string | null) => {
      const response = await fetch(
        `/api/listings?${buildListingsParams(cursor).toString()}`,
        {
          cache: 'no-store',
        }
      );

      const payload = (await response
        .json()
        .catch(() => null)) as ListingsPageResponse | null;

      if (!response.ok || !payload || !Array.isArray(payload.products)) {
        throw new Error(
          payload?.error || 'Unable to load listings right now. Please try again.'
        );
      }

      return payload;
    },
    [buildListingsParams]
  );

  const loadMoreProducts = useCallback(async () => {
    if (isLoadingMore || isRefreshingProducts || !hasMorePages) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const requestIdAtStart = listingRequestSequenceRef.current;
      const payload = await fetchListingsPage(nextCursor);
      if (requestIdAtStart !== listingRequestSequenceRef.current) {
        return;
      }

      setLoadedProducts((current) => {
        const knownIds = new Set(current.map((item) => item.id));
        const merged = [...current];

        for (const item of payload.products ?? []) {
          if (!knownIds.has(item.id)) {
            knownIds.add(item.id);
            merged.push(item);
          }
        }

        return merged;
      });

      setNextCursor(typeof payload.nextCursor === 'string' ? payload.nextCursor : null);
      setHasMorePages(Boolean(payload.hasMore));
    } catch (error) {
      toast({
        title: 'Could not load more listings',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchListingsPage, hasMorePages, isLoadingMore, isRefreshingProducts, nextCursor]);

  const handleLocationChange = useCallback((locData: LocationData | null) => {
    if (!locData) return;

    dispatch(setUserLocation(locData));
    dispatch(setUserCoords({ latitude: locData.latitude, longitude: locData.longitude }));
    dispatch(setLocation(`${locData.city}, ${locData.state}`));
  }, [dispatch]);

  const requestLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          const { latitude, longitude } = coords;

          dispatch(setUserCoords({ latitude, longitude }));

          const geocoded = await reverseGeocodeLocation(latitude, longitude);
          if (geocoded) {
            dispatch(
              setUserLocation({
                city: geocoded.city,
                state: geocoded.state,
                latitude,
                longitude,
              })
            );

            dispatch(setLocation(`${geocoded.city}, ${geocoded.state}`));
            return;
          }

          dispatch(setLocation('Current location'));
        },
        () => {
          const fallbackCoords = LOCATION_COORDINATES.bangalore;
          dispatch(
            setUserCoords({
              latitude: fallbackCoords.lat,
              longitude: fallbackCoords.lng,
            })
          );
          dispatch(
            setUserLocation({
              city: 'Bangalore',
              state: 'Karnataka',
              latitude: fallbackCoords.lat,
              longitude: fallbackCoords.lng,
            })
          );
          dispatch(setLocation('Bangalore'));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      const fallbackCoords = LOCATION_COORDINATES.bangalore;
      dispatch(
        setUserCoords({
          latitude: fallbackCoords.lat,
          longitude: fallbackCoords.lng,
        })
      );
      dispatch(
        setUserLocation({
          city: 'Bangalore',
          state: 'Karnataka',
          latitude: fallbackCoords.lat,
          longitude: fallbackCoords.lng,
        })
      );
      dispatch(setLocation('Bangalore'));
    }
  }, [dispatch]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) {
      return;
    }

    if (effectiveUserCoords || safeLocation) {
      return;
    }

    requestLocation();
  }, [effectiveUserCoords, isAuthenticated, isHydrated, requestLocation, safeLocation]);

  useEffect(() => {
    if (!isHydrated || safeUserCoords || !safeLocation) {
      return;
    }

    const knownCoords = getKnownCoordinates(safeLocation);
    if (knownCoords) {
      const [resolvedCity, resolvedState] = safeLocation
        .split(',')
        .map((part) => part.trim());

      dispatch(
        setUserCoords({
          latitude: knownCoords.lat,
          longitude: knownCoords.lng,
        })
      );

      dispatch(
        setUserLocation({
          city: resolvedCity || safeLocation,
          state: resolvedState || '',
          latitude: knownCoords.lat,
          longitude: knownCoords.lng,
        })
      );
      return;
    }

    let cancelled = false;

    void (async () => {
      const resolvedLocation = await searchLocationSuggestion(safeLocation);
      if (!resolvedLocation || cancelled) {
        return;
      }

      dispatch(setLocation(resolvedLocation.label));
      dispatch(
        setUserLocation({
          city: resolvedLocation.city,
          state: resolvedLocation.state,
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude,
        })
      );
      dispatch(
        setUserCoords({
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude,
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, isHydrated, safeLocation, safeUserCoords]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!hasCompletedInitialRefreshRef.current) {
      hasCompletedInitialRefreshRef.current = true;
      return;
    }

    const requestId = listingRequestSequenceRef.current + 1;
    listingRequestSequenceRef.current = requestId;
    let cancelled = false;
    const shouldShowRefreshSkeleton = hasCompletedInitialRefreshRef.current;

    setIsRefreshingProducts(true);
    setIsApplyingListingQuery(shouldShowRefreshSkeleton);

    void (async () => {
      try {
        const payload = await fetchListingsPage(null);
        if (cancelled || requestId !== listingRequestSequenceRef.current) {
          return;
        }

        setLoadedProducts(payload.products ?? []);
        setNextCursor(typeof payload.nextCursor === 'string' ? payload.nextCursor : null);
        setHasMorePages(Boolean(payload.hasMore));
      } catch (error) {
        if (cancelled || requestId !== listingRequestSequenceRef.current) {
          return;
        }

        toast({
          title: 'Could not refresh listings',
          description:
            error instanceof Error
              ? error.message
              : 'Please try again in a moment.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled && requestId === listingRequestSequenceRef.current) {
          setIsRefreshingProducts(false);
          setIsApplyingListingQuery(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchListingsPage, isHydrated]);

  const clearFilters = useCallback(() => {
    dispatch(clearMarketplaceFilters());
  }, [dispatch]);

  useEffect(() => {
    if (!isHydrated || hasRestoredFromCacheRef.current) {
      return;
    }

    hasRestoredFromCacheRef.current = true;
    const cachedState = readMarketplaceListCache();

    if (!cachedState || cachedState.queryKey !== listingQueryCacheKey) {
      setHasBootstrappedCache(true);
      return;
    }

    setLoadedProducts(cachedState.loadedProducts);
    setNextCursor(cachedState.nextCursor);
    setHasMorePages(cachedState.hasMorePages);
    pendingScrollRestoreRef.current = cachedState.scrollY;
    setHasBootstrappedCache(true);
  }, [isHydrated, listingQueryCacheKey]);

  useEffect(() => {
    if (!isHydrated || !hasBootstrappedCache) {
      return;
    }

    persistMarketplaceCache();
  }, [hasBootstrappedCache, isHydrated, persistMarketplaceCache]);

  useEffect(() => {
    if (!isHydrated || !hasBootstrappedCache) {
      return;
    }

    const handlePageHide = () => {
      persistMarketplaceCache(window.scrollY);
    };

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      persistMarketplaceCache(window.scrollY);
    };
  }, [hasBootstrappedCache, isHydrated, persistMarketplaceCache]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const targetScrollY = pendingScrollRestoreRef.current;
    if (targetScrollY == null || loadedProducts.length === 0) {
      return;
    }

    let timeoutId: number | null = null;
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: targetScrollY, behavior: 'auto' });

      timeoutId = window.setTimeout(() => {
        window.scrollTo({ top: targetScrollY, behavior: 'auto' });
      }, 120);

      pendingScrollRestoreRef.current = null;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isHydrated, loadedProducts.length]);

  return (
    <div className="bg-background">
      <main className="container">
        {safeLocation && (
          <div className="flex items-center gap-2 pt-4 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Showing results near: <span className="font-medium text-foreground">{safeLocation}</span>
          </div>
        )}
        {!safeLocation && (
          <div className="flex items-center gap-2 pt-4">
            <button
              onClick={requestLocation}
              className="flex items-center gap-1.5 text-sm text-foreground font-medium hover:text-primary hover:underline"
            >
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Enable location to see products near you
            </button>
          </div>
        )}

        <CategorySection
          selected={safeSelectedCategories}
          onClear={() => dispatch(setSelectedCategories([]))}
          onToggle={(categoryId) => {
            const nextSelectedCategories = safeSelectedCategories.includes(categoryId)
              ? safeSelectedCategories.filter((value) => value !== categoryId)
              : [...safeSelectedCategories, categoryId];

            dispatch(setSelectedCategories(nextSelectedCategories));
          }}
        />

        <FilterBar
          filter={safeFilter}
          onFilterChange={(nextFilter) => dispatch(setFilter(nextFilter))}
          rentDurations={safeRentDurations}
          onRentDurationsChange={(durations) => dispatch(setRentDurations(durations))}
          sort={effectiveSort}
          onSortChange={(nextSort) => {
            setHasManualSortSelection(true);
            dispatch(setSort(nextSort));
          }}
          hasActiveFilters={safeHasActiveFilters}
          onClearFilters={clearFilters}
          priceRange={safePriceRange}
          onPriceRangeChange={(range) => dispatch(setPriceRange(range))}
          location={safeUserLocation}
          onLocationChange={handleLocationChange}
        />

        <ProductGrid
          products={availableProducts}
          listingFilter={safeFilter}
          rentDurations={safeRentDurations}
          hasMore={hasMorePages && !isRefreshingProducts}
          isLoadingMore={isLoadingMore}
          isRefreshingResults={isApplyingListingQuery}
          onLoadMore={loadMoreProducts}
        />
      </main>
    </div>
  );
}

export default MarketplacePageClient;
