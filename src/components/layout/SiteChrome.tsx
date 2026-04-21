'use client';

import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { usePathname } from 'next/navigation';

import Footer from '@/components/marketplace/Footer';
import MarketplaceHeader from '@/components/marketplace/MarketplaceHeader';
import { toast } from '@/hooks/use-toast';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  selectLocation,
  selectSearchQuery,
  setLocation,
  setSearchQuery,
  setUserCoords,
  setUserLocation,
} from '@/store/slices/marketplaceSlice';

const CHROME_EXCLUDED_PATHS = new Set(['/profile', '/wishlist']);

type ManualLocationSelection = {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

type SiteChromeProps = {
  children: ReactNode;
};

function shouldHideSiteChrome(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return CHROME_EXCLUDED_PATHS.has(pathname);
}

export default function SiteChrome({ children }: SiteChromeProps) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const location = useAppSelector(selectLocation);
  const searchQuery = useAppSelector(selectSearchQuery);

  const hideChrome = shouldHideSiteChrome(pathname);
  const isHomePage = pathname === '/';

  const handleManualLocation = useCallback(
    (city: string, selection?: ManualLocationSelection) => {
      const normalizedCity = city.trim();
      dispatch(setLocation(normalizedCity || null));

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

      dispatch(setUserLocation(null));
      dispatch(setUserCoords(null));
    },
    [dispatch]
  );

  const handleRequestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast({
        title: 'Location unavailable',
        description: 'Your browser does not support location services.',
        variant: 'destructive',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          const { latitude, longitude } = position.coords;
          const fallbackCity = `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
              { cache: 'no-store' }
            );

            if (!response.ok) {
              throw new Error('Unable to resolve your location.');
            }

            const payload = (await response.json()) as {
              address?: {
                city?: string;
                town?: string;
                village?: string;
                county?: string;
                state?: string;
              };
            };

            const city =
              payload.address?.city ??
              payload.address?.town ??
              payload.address?.village ??
              payload.address?.county ??
              '';
            const state = payload.address?.state ?? '';
            const resolvedLabel = [city, state].filter(Boolean).join(', ');

            dispatch(setLocation(resolvedLabel || fallbackCity));
            dispatch(
              setUserLocation({
                city: city || fallbackCity,
                state,
                latitude,
                longitude,
              })
            );
            dispatch(setUserCoords({ latitude, longitude }));
          } catch {
            dispatch(setLocation(fallbackCity));
            dispatch(
              setUserLocation({
                city: fallbackCity,
                state: '',
                latitude,
                longitude,
              })
            );
            dispatch(setUserCoords({ latitude, longitude }));
          }
        })();
      },
      () => {
        toast({
          title: 'Location permission denied',
          description: 'Allow location access to auto-detect your city.',
          variant: 'destructive',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, [dispatch]);

  if (hideChrome) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketplaceHeader
        location={location}
        onRequestLocation={handleRequestLocation}
        onManualLocation={handleManualLocation}
        searchQuery={isHomePage ? searchQuery : ''}
        onSearchChange={(query) => dispatch(setSearchQuery(query))}
        searchPageHref={isHomePage ? undefined : '/search'}
      />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
