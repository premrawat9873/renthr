'use client';

import { useMemo, useCallback, useState, useSyncExternalStore } from 'react';
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
import { useAppDispatch, useAppSelector } from '@/store/hooks';
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

const NEARBY_RADIUS_KM = 12;
const PAGE_SIZE = 10;
const subscribeHydration = () => () => {};
const EMPTY_DURATIONS: RentDuration[] = [];
const DEFAULT_PRICE_RANGE: [number, number] = [0, MAX_PRICE];

const LOCATION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Bangalore: { lat: 12.9716, lng: 77.5946 },
  Koramangala: { lat: 12.9352, lng: 77.6245 },
  Indiranagar: { lat: 12.9719, lng: 77.6412 },
  'HSR Layout': { lat: 12.9116, lng: 77.6474 },
  Whitefield: { lat: 12.9698, lng: 77.75 },
  'MG Road': { lat: 12.9755, lng: 77.6067 },
  Jayanagar: { lat: 12.9279, lng: 77.5938 },
  'BTM Layout': { lat: 12.9166, lng: 77.6101 },
  'Electronic City': { lat: 12.8399, lng: 77.677 },
  Marathahalli: { lat: 12.9591, lng: 77.6974 },
  Hebbal: { lat: 13.0358, lng: 77.597 },
  'Sarjapur Road': { lat: 12.901, lng: 77.686 },
};

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
  const dispatch = useAppDispatch();
  const [loadedProducts, setLoadedProducts] = useState<ListingProductPayload[]>(initialProducts);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMorePages, setHasMorePages] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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
          dispatch(setUserCoords(null));
          dispatch(setUserLocation(null));
          dispatch(setLocation('Bangalore'));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      dispatch(setUserCoords(null));
      dispatch(setUserLocation(null));
      dispatch(setLocation('Bangalore'));
    }
  }, [dispatch]);

  const handleManualLocation = useCallback((city: string) => {
    dispatch(setLocation(city));
    const normalizedCity = city.split(',')[0].trim();
    const knownCoords = LOCATION_COORDINATES[normalizedCity];
    if (knownCoords) {
      dispatch(setUserCoords({ latitude: knownCoords.lat, longitude: knownCoords.lng }));
      return;
    }
    dispatch(setUserCoords(null));
  }, [dispatch]);

  const clearFilters = useCallback(() => {
    dispatch(clearMarketplaceFilters());
  }, [dispatch]);

  const filteredProducts = useMemo(() => {
    let results = [...availableProducts];

    results = results.map((product) => {
      if (!safeUserCoords) return product;
      const productCoords = LOCATION_COORDINATES[product.location];
      if (!productCoords) return product;

      const computedDistance = haversineDistanceKm(safeUserCoords, productCoords);
      return { ...product, distance: Number(computedDistance.toFixed(1)) };
    });

    if (safeSearchQuery) {
      const q = safeSearchQuery.toLowerCase();
      results = results.filter(
        (p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      );
    }

    if (safeSelectedCategory) {
      results = results.filter((p) => p.category === safeSelectedCategory);
    }

    if (safeFilter === 'rent') results = results.filter((p) => supportsRent(p));
    if (safeFilter === 'sell') results = results.filter((p) => supportsSell(p));

    if (safeUserCoords) {
      const nearbyResults = results.filter((p) => p.distance <= NEARBY_RADIUS_KM);
      if (nearbyResults.length > 0) {
        results = nearbyResults;
      }
      results.sort((a, b) => a.distance - b.distance);
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

    if (safeSort === 'newest') {
      results.sort((a, b) => {
        const byTime = b.postedAt.getTime() - a.postedAt.getTime();
        return byTime !== 0 ? byTime : compareById(a.id, b.id);
      });
    }
    if (safeSort === 'distance') {
      results.sort((a, b) => {
        const byDistance = a.distance - b.distance;
        return byDistance !== 0 ? byDistance : compareById(a.id, b.id);
      });
    }
    if (safeSort === 'price-asc') {
      results.sort((a, b) => {
        const pa = getComparablePrice(a, safeFilter) ?? Infinity;
        const pb = getComparablePrice(b, safeFilter) ?? Infinity;
        const byPrice = pa - pb;
        return byPrice !== 0 ? byPrice : compareById(a.id, b.id);
      });
    }
    if (safeSort === 'price-desc') {
      results.sort((a, b) => {
        const pa = getComparablePrice(a, safeFilter) ?? 0;
        const pb = getComparablePrice(b, safeFilter) ?? 0;
        const byPrice = pb - pa;
        return byPrice !== 0 ? byPrice : compareById(a.id, b.id);
      });
    }

    return results;
  }, [availableProducts, safeSearchQuery, safeSelectedCategory, safeFilter, safeRentDurations, safeSort, safePriceRange, safeUserCoords]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketplaceHeader
        location={safeLocation}
        onRequestLocation={requestLocation}
        onManualLocation={handleManualLocation}
        searchQuery={safeSearchQuery}
        onSearchChange={(query) => dispatch(setSearchQuery(query))}
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
          sort={safeSort}
          onSortChange={(nextSort) => dispatch(setSort(nextSort))}
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
    </div>
  );
}

export default MarketplacePageClient;
