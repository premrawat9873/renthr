'use client';

import { useMemo, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import MarketplaceHeader from '@/components/marketplace/MarketplaceHeader';
import CategorySection from '@/components/marketplace/CategorySection';
import FilterBar from '@/components/marketplace/FilterBar';
import ProductGrid from '@/components/marketplace/ProductGrid';
import Footer from '@/components/marketplace/Footer';
import {
  deserializeListingProduct,
  type ListingProductPayload,
} from '@/data/listings';
import type { ListingFilter, Product, RentDuration } from '@/data/marketplaceData';
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
  selectSelectedCategory,
  selectSort,
  selectUserCoords,
  selectUserLocation,
  setFilter,
  setLocation,
  setPriceRange,
  setRentDurations,
  setSearchQuery,
  setSelectedCategory,
  setSort,
  setUserCoords,
  setUserLocation,
} from '@/store/slices/marketplaceSlice';
import { useWishlistBootstrap } from '@/hooks/use-wishlist';

const NEARBY_RADIUS_KM = 12;
const PAGE_SIZE = 10;
const PostListingFlowDialog = dynamic(
  () => import('@/components/marketplace/PostListingFlowDialog'),
  { ssr: false }
);
const subscribeHydration = () => () => {};
const EMPTY_DURATIONS: RentDuration[] = [];
const DEFAULT_PRICE_RANGE: [number, number] = [0, MAX_PRICE];

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

const CATEGORY_FILTER_ALIASES: Record<string, string> = {
  "home-appliances": "appliances",
  "baby-kids": "baby",
  kids: "baby",
};

function normalizeCategoryFilterKey(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return CATEGORY_FILTER_ALIASES[normalized] ?? normalized;
}

function normalizeDistanceForSorting(distance: number) {
  if (!Number.isFinite(distance) || distance < 0) {
    return Number.POSITIVE_INFINITY;
  }

  return distance;
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(
  from: { latitude: number; longitude: number },
  to: { lat: number; lng: number }
) {
  const earthRadiusKm = 6371;
  const dLat = toRad(to.lat - from.latitude);
  const dLng = toRad(to.lng - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
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

function compareById(aId: string, bId: string) {
  return aId.localeCompare(bId, undefined, { numeric: true });
}

function supportsRent(product: Product) {
  return product.type === 'rent' || product.type === 'both';
}

function supportsSell(product: Product) {
  return product.type === 'sell' || product.type === 'both';
}

function getPrimaryRentPrice(product: Product) {
  if (!product.rentPrices) {
    return null;
  }

  return (
    product.rentPrices.daily ??
    product.rentPrices.hourly ??
    product.rentPrices.weekly ??
    product.rentPrices.monthly ??
    null
  );
}

function getComparablePrice(product: Product, filter: ListingFilter) {
  if (filter === 'sell') {
    return product.price;
  }

  if (filter === 'rent') {
    return getPrimaryRentPrice(product);
  }

  if (product.type === 'sell') {
    return product.price;
  }

  if (product.type === 'rent') {
    return getPrimaryRentPrice(product);
  }

  const candidates = [product.price, getPrimaryRentPrice(product)].filter(
    (value): value is number => value != null
  );

  return candidates.length > 0 ? Math.min(...candidates) : null;
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
  const [hasManualSortSelection, setHasManualSortSelection] = useState(false);
  const [isPostFlowOpen, setIsPostFlowOpen] = useState(false);
  const reduxAuthenticated = useAppSelector(selectIsAuthenticated);
  const location = useAppSelector(selectLocation);
  const userLocation = useAppSelector(selectUserLocation);
  const userCoords = useAppSelector(selectUserCoords);
  const searchQuery = useAppSelector(selectSearchQuery);
  const selectedCategory = useAppSelector(selectSelectedCategory);
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
  const safeSelectedCategory = isHydrated ? selectedCategory : null;
  const safeFilter = isHydrated ? filter : 'all';
  const safeRentDurations = isHydrated ? rentDurations : EMPTY_DURATIONS;
  const safeSort = isHydrated ? sort : 'newest';
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
  const availableProducts = useMemo(
    () => loadedProducts.map(deserializeListingProduct),
    [loadedProducts]
  );

  const loadMoreProducts = useCallback(async () => {
    if (isLoadingMore || !hasMorePages) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      if (nextCursor) {
        params.set('cursor', nextCursor);
      }

      const response = await fetch(`/api/listings?${params.toString()}`, {
        cache: 'no-store',
      });

      const payload = (await response
        .json()
        .catch(() => null)) as ListingsPageResponse | null;

      if (!response.ok || !payload || !Array.isArray(payload.products)) {
        throw new Error(
          payload?.error || 'Unable to load more listings right now. Please try again.'
        );
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
  }, [hasMorePages, isLoadingMore, nextCursor]);

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

  const handleManualLocation = useCallback((city: string, selection?: LocationData) => {
    const normalizedLocation = city.trim();

    if (!normalizedLocation) {
      dispatch(setLocation(null));
      dispatch(setUserCoords(null));
      dispatch(setUserLocation(null));
      return;
    }

    dispatch(setLocation(normalizedLocation));

    if (selection) {
      dispatch(
        setUserLocation({
          city: selection.city,
          state: selection.state,
          latitude: selection.latitude,
          longitude: selection.longitude,
        })
      );
      dispatch(
        setUserCoords({
          latitude: selection.latitude,
          longitude: selection.longitude,
        })
      );
      return;
    }

    const knownCoords = getKnownCoordinates(normalizedLocation);
    if (knownCoords) {
      const [resolvedCity, resolvedState] = normalizedLocation
        .split(',')
        .map((part) => part.trim());

      dispatch(
        setUserLocation({
          city: resolvedCity || normalizedLocation,
          state: resolvedState || '',
          latitude: knownCoords.lat,
          longitude: knownCoords.lng,
        })
      );
      dispatch(
        setUserCoords({
          latitude: knownCoords.lat,
          longitude: knownCoords.lng,
        })
      );
      return;
    }

    dispatch(setUserCoords(null));
    dispatch(setUserLocation(null));

    void (async () => {
      const resolvedLocation = await searchLocationSuggestion(normalizedLocation);
      if (!resolvedLocation) {
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
  }, [dispatch]);

  const clearFilters = useCallback(() => {
    dispatch(clearMarketplaceFilters());
  }, [dispatch]);

  const openPostFlow = useCallback(() => {
    setIsPostFlowOpen(true);
  }, []);

  const filteredProducts = useMemo(() => {
    let results = [...availableProducts];

    results = results.map((product) => {
      if (!effectiveUserCoords) return product;
      const productCoords = getKnownCoordinates(product.location);
      if (!productCoords) {
        return {
          ...product,
          distance: Number.isFinite(product.distance) && product.distance >= 0
            ? product.distance
            : -1,
        };
      }

      const computedDistance = haversineDistanceKm(effectiveUserCoords, productCoords);
      return { ...product, distance: Number(computedDistance.toFixed(1)) };
    });

    if (safeSearchQuery) {
      const q = safeSearchQuery.toLowerCase();
      results = results.filter(
        (p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      );
    }

    if (safeSelectedCategory) {
      const selectedCategoryKey = normalizeCategoryFilterKey(safeSelectedCategory);
      results = results.filter(
        (p) => normalizeCategoryFilterKey(p.category) === selectedCategoryKey
      );
    }

    if (safeFilter === 'rent') results = results.filter((p) => supportsRent(p));
    if (safeFilter === 'sell') results = results.filter((p) => supportsSell(p));

    if (effectiveUserCoords) {
      const nearbyResults = results.filter(
        (p) => Number.isFinite(p.distance) && p.distance >= 0 && p.distance <= NEARBY_RADIUS_KM
      );
      if (nearbyResults.length > 0) {
        results = nearbyResults;
      }
      results.sort((a, b) => {
        const aDistance = normalizeDistanceForSorting(a.distance);
        const bDistance = normalizeDistanceForSorting(b.distance);
        if (aDistance === bDistance) {
          return compareById(a.id, b.id);
        }
        const byDistance = aDistance - bDistance;
        return byDistance !== 0 ? byDistance : compareById(a.id, b.id);
      });
    }

    if (safeFilter === 'rent' && safeRentDurations.length > 0) {
      results = results.filter((p) => {
        if (!supportsRent(p) || !p.rentPrices) return false;
        return safeRentDurations.some((d) => p.rentPrices![d] != null);
      });
    }

    if (safePriceRange[0] > 0 || safePriceRange[1] < MAX_PRICE) {
      results = results.filter((p) => {
        const price = getComparablePrice(p, safeFilter);
        if (price == null) {
          return false;
        }
        return price >= safePriceRange[0] && price <= safePriceRange[1];
      });
    }

    if (effectiveSort === 'newest') {
      results.sort((a, b) => {
        const byTime = b.postedAt.getTime() - a.postedAt.getTime();
        return byTime !== 0 ? byTime : compareById(a.id, b.id);
      });
    }
    if (effectiveSort === 'distance') {
      results.sort((a, b) => {
        const aDistance = normalizeDistanceForSorting(a.distance);
        const bDistance = normalizeDistanceForSorting(b.distance);
        if (aDistance === bDistance) {
          return compareById(a.id, b.id);
        }
        const byDistance = aDistance - bDistance;
        return byDistance !== 0 ? byDistance : compareById(a.id, b.id);
      });
    }
    if (effectiveSort === 'price-asc') {
      results.sort((a, b) => {
        const pa = getComparablePrice(a, safeFilter) ?? Infinity;
        const pb = getComparablePrice(b, safeFilter) ?? Infinity;
        const byPrice = pa - pb;
        return byPrice !== 0 ? byPrice : compareById(a.id, b.id);
      });
    }
    if (effectiveSort === 'price-desc') {
      results.sort((a, b) => {
        const pa = getComparablePrice(a, safeFilter) ?? 0;
        const pb = getComparablePrice(b, safeFilter) ?? 0;
        const byPrice = pb - pa;
        return byPrice !== 0 ? byPrice : compareById(a.id, b.id);
      });
    }

    return results;
  }, [availableProducts, effectiveSort, effectiveUserCoords, safeFilter, safePriceRange, safeRentDurations, safeSearchQuery, safeSelectedCategory]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketplaceHeader
        location={safeLocation}
        onRequestLocation={requestLocation}
        onManualLocation={handleManualLocation}
        searchQuery={safeSearchQuery}
        onSearchChange={(query) => dispatch(setSearchQuery(query))}
        onAddPost={openPostFlow}
      />

      <main className="container flex-1">
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
              className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
            >
              <MapPin className="h-3.5 w-3.5" />
              Enable location to see products near you
            </button>
          </div>
        )}

        <CategorySection selected={safeSelectedCategory} onSelect={(category) => dispatch(setSelectedCategory(category))} />

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
          products={filteredProducts}
          rentDurations={safeRentDurations}
          hasMore={hasMorePages}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMoreProducts}
        />
      </main>

      <Footer />

      {isPostFlowOpen ? (
        <PostListingFlowDialog open={isPostFlowOpen} onOpenChange={setIsPostFlowOpen} />
      ) : null}
    </div>
  );
}

export default MarketplacePageClient;
