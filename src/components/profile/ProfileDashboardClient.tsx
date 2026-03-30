'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Share2,
  Heart,
  Package,
  CalendarCheck,
  Star,
  CheckCircle2,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  Settings,
  Plus,
  TrendingUp,
  Award,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import PostListingFlowDialog from '@/components/marketplace/PostListingFlowDialog';
import type { Product } from '@/data/marketplaceData';
import { formatPrice, formatTimeAgo } from '@/data/marketplaceData';
import { cn } from '@/lib/utils';

type TabKey = 'listings' | 'bookings' | 'wishlist' | 'settings';

type ProfileDashboardClientProps = {
  displayName: string;
  email: string;
  cityLabel: string;
  joinedLabel: string;
  products: Product[];
};

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

function getProductPriceLabel(product: Product) {
  if ((product.type === 'rent' || product.type === 'both') && product.rentPrices) {
    const rentPrice = getPrimaryRentPrice(product);
    if (rentPrice != null) {
      return `${formatPrice(rentPrice)}/day`;
    }
  }

  if (product.price != null) {
    return formatPrice(product.price);
  }

  return 'Price on request';
}

function getListingBadge(product: Product) {
  if (product.featured) {
    return 'Popular in your area';
  }

  if ((product.rating ?? 0) >= 4.7) {
    return 'Highly rated';
  }

  return null;
}

function getTabIcon(tab: TabKey) {
  if (tab === 'listings') return Package;
  if (tab === 'bookings') return Calendar;
  if (tab === 'wishlist') return Heart;
  return Settings;
}

export default function ProfileDashboardClient({
  displayName,
  email,
  cityLabel,
  joinedLabel,
  products,
}: ProfileDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('listings');
  const [postFlowOpen, setPostFlowOpen] = useState(false);
  const [availabilityById, setAvailabilityById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(products.map((product) => [product.id, true]))
  );

  const totalListings = products.length;
  const totalRentals = products.filter(
    (product) => product.type === 'rent' || product.type === 'both'
  ).length;
  const totalReviews = products.reduce((sum, product) => sum + (product.reviewCount ?? 0), 0);

  const averageRating = useMemo(() => {
    const ratingValues = products
      .map((product) => product.rating)
      .filter((rating): rating is number => typeof rating === 'number');

    if (ratingValues.length === 0) {
      return 0;
    }

    const total = ratingValues.reduce((sum, rating) => sum + rating, 0);
    return total / ratingValues.length;
  }, [products]);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'listings', label: 'My Listings' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'wishlist', label: 'Wishlist' },
    { key: 'settings', label: 'Settings' },
  ];

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/home');
  };

  const toggleAvailability = (productId: string) => {
    setAvailabilityById((current) => ({
      ...current,
      [productId]: !current[productId],
    }));
  };

  const renderListingsGrid = () => {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div className="group relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 p-6 shadow-lg transition-all duration-300 hover:shadow-xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute left-4 top-4 h-24 w-24 rounded-full border-2 border-primary-foreground" />
            <div className="absolute bottom-8 right-4 h-16 w-16 rounded-full border-2 border-primary-foreground" />
            <div className="absolute right-8 top-1/2 h-8 w-8 rounded-full bg-primary-foreground" />
          </div>

          <div className="relative z-10 space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/20 backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-primary-foreground/30">
              <Plus className="h-8 w-8 text-primary-foreground" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-primary-foreground">List a new product</h3>
              <p className="mx-auto max-w-[180px] text-sm leading-relaxed text-primary-foreground/80">
                Start earning by sharing your items with the community
              </p>
            </div>

            <Button
              type="button"
              onClick={() => setPostFlowOpen(true)}
              className="mt-2 bg-primary-foreground font-medium text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-foreground/90 hover:shadow-lg"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Listing
            </Button>

            <div className="flex items-center justify-center gap-1.5 pt-2">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground/70" />
              <span className="text-xs text-primary-foreground/70">Quick & easy setup</span>
            </div>
          </div>
        </div>

        {products.map((product) => {
          const isAvailable = availabilityById[product.id] ?? true;
          const badge = getListingBadge(product);
          const isRent = product.type === 'rent' || product.type === 'both';
          const locationSummary =
            product.distance > 0
              ? `${product.location} · ${product.distance.toFixed(1)} km`
              : `${product.location} · 0 km`;

          return (
            <Link key={product.id} href={`/product/${product.id}`}>
              <article className="group overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={product.image}
                    alt={product.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-primary/90 px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm backdrop-blur-sm">
                      {isRent ? 'Rent' : 'Sell'}
                    </span>
                    {product.featured && (
                      <span className="rounded-full bg-accent/90 px-2.5 py-1 text-xs font-medium text-accent-foreground shadow-sm backdrop-blur-sm">
                        Featured
                      </span>
                    )}
                  </div>

                  {badge && (
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-card/95 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
                        {badge === 'Highly rated' ? (
                          <Award className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <TrendingUp className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span className="text-xs font-medium text-foreground">{badge}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="text-balance font-semibold leading-snug text-foreground transition-colors duration-200 group-hover:text-primary">
                      {product.title}
                    </h3>

                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-current text-primary/80" />
                      <span className="text-sm font-medium text-foreground">
                        {product.rating != null ? product.rating.toFixed(1) : '4.6'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({product.reviewCount ?? 0} reviews)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-primary">{getProductPriceLabel(product)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{locationSummary}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatTimeAgo(product.postedAt)}</span>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between border-t border-border/50 pt-2"
                    onClick={(event) => {
                      event.preventDefault();
                    }}
                  >
                    <span className={cn('text-sm font-medium', isAvailable ? 'text-primary' : 'text-muted-foreground')}>
                      {isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                    <Switch
                      checked={isAvailable}
                      onCheckedChange={() => toggleAvailability(product.id)}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
      </div>
    );
  };

  const renderTabContent = () => {
    if (activeTab === 'listings') {
      return renderListingsGrid();
    }

    if (activeTab === 'bookings') {
      return (
        <div className="rounded-2xl border border-border/50 bg-card p-12 text-center shadow-sm">
          <p className="text-muted-foreground">Your bookings will appear here</p>
        </div>
      );
    }

    if (activeTab === 'wishlist') {
      return (
        <div className="rounded-2xl border border-border/50 bg-card p-12 text-center shadow-sm">
          <p className="text-muted-foreground">Items you&apos;ve saved will appear here</p>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-border/50 bg-card p-12 text-center shadow-sm">
        <p className="text-muted-foreground">Account settings coming soon</p>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="-ml-2 text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-foreground"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>

            <Link href="/home" className="flex items-center gap-1">
              <span className="text-xl font-semibold tracking-tight text-foreground">rent</span>
              <span className="rounded-md bg-accent px-2 py-0.5 text-xl font-bold text-accent-foreground">
                hour
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-foreground"
            >
              <Share2 className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-foreground"
            >
              <Heart className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Save</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="mb-6 rounded-2xl border border-border/50 bg-card p-5 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="group relative">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/30 via-accent/20 to-primary/30 blur-sm transition-all duration-300 group-hover:blur-md" />
                <div className="relative h-28 w-28 overflow-hidden rounded-full ring-4 ring-card shadow-lg">
                  <Image
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face"
                    alt={displayName}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-primary shadow-sm">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-primary-foreground" />
                </div>
              </div>

              <div className="space-y-3 text-center sm:text-left">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">{displayName}</h1>

                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Verified Seller</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 text-muted-foreground sm:flex-row sm:gap-4">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{cityLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">{joinedLabel}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 sm:justify-start">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-2.5 py-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Usually responds within 1 hour</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/30 px-2.5 py-1">
                    <Sparkles className="h-3.5 w-3.5 text-accent-foreground" />
                    <span className="text-xs font-medium text-accent-foreground">Trusted since 2026</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 lg:ml-auto lg:justify-end">
              <div className="group flex h-28 w-28 cursor-default flex-col items-center justify-center rounded-2xl border border-border/50 bg-accent/30 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/60 hover:shadow-md">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <span className="text-2xl font-bold text-foreground">{totalListings}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">Total Listings</span>
              </div>

              <div className="group flex h-28 w-28 cursor-default flex-col items-center justify-center rounded-2xl border border-border/50 bg-accent/30 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/60 hover:shadow-md">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                  <CalendarCheck className="h-5 w-5 text-primary" />
                </div>
                <span className="text-2xl font-bold text-foreground">{totalRentals}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">Total Rentals</span>
              </div>

              <div className="group flex h-28 w-28 cursor-default flex-col items-center justify-center rounded-2xl border border-border/50 bg-accent/30 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/60 hover:shadow-md">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                  <Star className="h-5 w-5 fill-current text-primary" />
                </div>
                <span className="text-2xl font-bold text-foreground">
                  {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">{totalReviews} reviews</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-6">
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {tabs.map((tab) => {
              const Icon = getTabIcon(tab.key);
              const isActive = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 ease-out',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-4 w-4 transition-transform duration-300', isActive && 'scale-110')} />
                  {tab.label}
                  {isActive && <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        {renderTabContent()}
      </div>

      <PostListingFlowDialog open={postFlowOpen} onOpenChange={setPostFlowOpen} />
    </main>
  );
}
