'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Share2,
  Heart,
  LayoutGrid,
  Car,
  Bike,
  Smartphone,
  Home,
  Building2,
  BedDouble,
  Tv,
  ChevronRight,
  ChevronLeft,
  Camera,
  Expand,
  MapPin,
  CheckCircle2,
  Tag,
  Clock,
  MessageCircle,
  Star,
  ChevronDown,
  ChevronUp,
  Navigation,
  Calendar,
  Info,
  Shield,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { CATEGORIES } from '@/data/mockData';
import type { ListingProductPayload } from '@/data/listings';
import { formatPrice, type RentDuration } from '@/data/marketplaceData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectIsWishlisted, toggleWishlist } from '@/store/slices/wishlistSlice';

const CATEGORY_ITEMS = [
  { id: 'all', label: 'All Categories', icon: LayoutGrid },
  { id: 'cars', label: 'Cars', icon: Car },
  { id: 'motorcycles', label: 'Motorcycles', icon: Bike },
  { id: 'phones', label: 'Mobile Phones', icon: Smartphone },
  { id: 'sale', label: 'For Sale: Houses', icon: Home },
  { id: 'rent', label: 'For Rent: Apartments', icon: Building2 },
  { id: 'furniture', label: 'Beds-Wardrobes', icon: BedDouble },
  { id: 'electronics', label: 'TVs, Video - Audio', icon: Tv },
] as const;

const DURATION_LABELS: Record<RentDuration, { label: string; suffix: string }> = {
  hourly: { label: 'Hourly', suffix: '/hr' },
  daily: { label: 'Daily', suffix: '/day' },
  weekly: { label: 'Weekly', suffix: '/wk' },
  monthly: { label: 'Monthly', suffix: '/mo' },
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatPostedAgo(postedAtIso: string) {
  const postedAt = new Date(postedAtIso);
  if (Number.isNaN(postedAt.getTime())) {
    return 'Posted recently';
  }

  const diffMs = Date.now() - postedAt.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));

  if (minutes < 60) {
    return `Posted ${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Posted ${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  const days = Math.floor(hours / 24);
  return `Posted ${days} day${days > 1 ? 's' : ''} ago`;
}

function getDistanceLabel(distance: number) {
  if (!Number.isFinite(distance) || distance < 0) {
    return 'Near you';
  }

  if (distance === 0) {
    return '0 km away';
  }

  return `${distance.toFixed(1)} km away`;
}

function getOwnerInitials(name: string) {
  const parts = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'U';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export default function ProductDetailClient({ product }: { product: ListingProductPayload }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const liked = useAppSelector((state) => selectIsWishlisted(state, product.id));

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const images = product.images.length > 0 ? product.images : [product.image];
  const currentImage = images[activeImageIndex] ?? images[0];

  const availablePricing = useMemo(() => {
    if (!product.rentPrices) {
      return [] as Array<{
        id: RentDuration;
        label: string;
        price: number;
        suffix: string;
      }>;
    }

    return (['hourly', 'daily', 'weekly', 'monthly'] as RentDuration[])
      .map((key) => {
        const value = product.rentPrices?.[key];
        if (value == null) {
          return null;
        }

        return {
          id: key,
          label: DURATION_LABELS[key].label,
          price: value,
          suffix: DURATION_LABELS[key].suffix,
        };
      })
      .filter((item): item is { id: RentDuration; label: string; price: number; suffix: string } => item != null);
  }, [product.rentPrices]);

  const [selectedPricing, setSelectedPricing] = useState<RentDuration>(
    availablePricing[0]?.id ?? 'daily'
  );
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date(Date.now() + DAY_IN_MS)));

  const selectedOption =
    availablePricing.find((option) => option.id === selectedPricing) ?? availablePricing[0] ?? null;

  const totalUnits = useMemo(() => {
    if (!selectedOption) {
      return 0;
    }

    const from = new Date(`${startDate}T00:00:00`);
    const to = new Date(`${endDate}T00:00:00`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return 1;
    }

    const totalDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_IN_MS));

    if (selectedOption.id === 'hourly') {
      return totalDays * 24;
    }

    if (selectedOption.id === 'weekly') {
      return Math.ceil(totalDays / 7);
    }

    if (selectedOption.id === 'monthly') {
      return Math.ceil(totalDays / 30);
    }

    return totalDays;
  }, [selectedOption, startDate, endDate]);

  const subtotal = selectedOption ? selectedOption.price * Math.max(1, totalUnits) : 0;
  const serviceFee = Math.round(subtotal * 0.1);
  const total = subtotal + serviceFee;

  const hasBuyPrice =
    (product.type === 'sell' || product.type === 'both') && typeof product.price === 'number';
  const hasRentalPricing =
    (product.type === 'rent' || product.type === 'both') && availablePricing.length > 0;

  const categoryLabel = CATEGORIES.find((category) => category.id === product.category)?.label ?? 'Listing';
  const postedLabel = formatPostedAgo(product.postedAt);
  const ownerDisplayName = product.ownerName || 'User';
  const ownerProfileHref = product.ownerId ? `/profile/${product.ownerId}` : null;

  const listingDescription =
    product.description ||
    `${product.title} is available in ${product.location}. Contact the seller to confirm details, accessory availability, and pickup preferences.`;
  const canTruncateDescription = listingDescription.length > 300;
  const visibleDescription =
    isDescriptionExpanded || !canTruncateDescription
      ? listingDescription
      : `${listingDescription.slice(0, 300)}...`;

  const handleNextImage = () => {
    setActiveImageIndex((current) => (current + 1) % images.length);
  };

  const handlePreviousImage = () => {
    setActiveImageIndex((current) => (current - 1 + images.length) % images.length);
  };

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : `/product/${product.id}`;

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: product.title,
          text: `Check this listing on RentHour: ${product.title}`,
          url: shareUrl,
        });
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {
      // Ignore user-cancelled share/copy failures.
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/home');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
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
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleShare()}
              className="text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-foreground"
            >
              <Share2 className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch(toggleWishlist(product.id))}
              className="group text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-foreground"
            >
              <Heart
                className={cn(
                  'mr-1.5 h-4 w-4 transition-colors',
                  liked
                    ? 'fill-destructive text-destructive'
                    : 'group-hover:fill-destructive/80 group-hover:text-destructive/90'
                )}
              />
              <span className="hidden sm:inline">Save</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b border-border/50 bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORY_ITEMS.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'bg-muted text-muted-foreground hover:bg-accent/70 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-6">
        <nav className="flex items-center gap-1 overflow-x-auto text-sm">
          <Link href="/home" className="p-1 text-muted-foreground transition-colors hover:text-foreground">
            <Home className="h-4 w-4" />
          </Link>

          <div className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            <span className="whitespace-nowrap text-muted-foreground">{categoryLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            <span className="whitespace-nowrap text-muted-foreground">{product.location}</span>
          </div>
          <div className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            <span className="max-w-[220px] truncate font-medium text-foreground">{product.title}</span>
          </div>
        </nav>

        <div className="mt-6 lg:grid lg:grid-cols-12 lg:gap-8">
          <div className="space-y-6 lg:col-span-7">
            <section className="space-y-3">
              <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
                <Image
                  src={currentImage}
                  alt={product.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  priority
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <button
                  type="button"
                  onClick={handlePreviousImage}
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-card group-hover:opacity-100"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5 text-foreground" />
                </button>
                <button
                  type="button"
                  onClick={handleNextImage}
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-card group-hover:opacity-100"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5 text-foreground" />
                </button>

                <button
                  type="button"
                  className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-card/90 px-4 py-2 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-card group-hover:opacity-100"
                >
                  <Camera className="h-4 w-4" />
                  <span className="text-sm font-medium">View all {images.length} photos</span>
                </button>

                <button
                  type="button"
                  className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-card/90 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-card group-hover:opacity-100"
                  aria-label="Expand image"
                >
                  <Expand className="h-4 w-4" />
                </button>

                <div className="absolute bottom-4 left-4 rounded-full bg-card/90 px-3 py-1.5 text-sm font-medium shadow-lg backdrop-blur-sm">
                  {activeImageIndex + 1} / {images.length}
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={cn(
                      'relative h-20 w-20 shrink-0 overflow-hidden rounded-xl transition-all duration-200',
                      index === activeImageIndex
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                        : 'opacity-60 hover:opacity-100'
                    )}
                  >
                    <Image
                      src={image}
                      alt={`${product.title} thumbnail ${index + 1}`}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-0 bg-primary/10 text-primary hover:bg-primary/20">
                  <Tag className="mr-1 h-3 w-3" />
                  {categoryLabel}
                </Badge>
                <Badge className="border-0 bg-green-100 text-green-700 hover:bg-green-200">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Verified Listing
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  <Clock className="mr-1 h-3 w-3" />
                  {postedLabel}
                </Badge>
              </div>

              <h1 className="text-balance text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                {product.title}
              </h1>

              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="flex items-center gap-1.5 rounded-full bg-accent/60 px-3 py-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{product.location}</span>
                </div>
                <span className="text-sm">{getDistanceLabel(product.distance)}</span>
              </div>
            </section>

            <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-shadow duration-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-14 w-14 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                      {product.ownerImage ? <AvatarImage src={product.ownerImage} /> : null}
                      <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                        {getOwnerInitials(ownerDisplayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-green-500">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{ownerDisplayName}</h3>
                      {typeof product.rating === 'number' && (
                        <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-sm text-primary">
                          <Star className="h-3 w-3 fill-primary/80 text-primary" />
                          {product.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified Seller
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Usually responds within 1 hour
                    </div>
                  </div>
                </div>

                {ownerProfileHref ? (
                  <Link href={ownerProfileHref}>
                    <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-foreground">
                      <span className="hidden sm:inline">View Profile</span>
                      <ChevronRight className="h-4 w-4 sm:ml-1" />
                    </Button>
                  </Link>
                ) : null}
              </div>

              <Button className="mt-4 h-11 w-full gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/80">
                <MessageCircle className="h-4 w-4" />
                Message Seller
              </Button>
            </section>

            <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-foreground">About this listing</h2>

              <div className="space-y-3">
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {visibleDescription}
                </p>

                {canTruncateDescription && (
                  <button
                    type="button"
                    onClick={() => setIsDescriptionExpanded((current) => !current)}
                    className="flex items-center gap-1 text-sm font-medium text-primary transition-all hover:underline"
                  >
                    {isDescriptionExpanded ? (
                      <>
                        Show less
                        <ChevronUp className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Read more
                        <ChevronDown className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-foreground">Location</h2>

              <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-gradient-to-br from-accent/65 to-muted">
                <div className="absolute inset-0 opacity-30">
                  <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <pattern id="map-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary/20" />
                      </pattern>
                    </defs>
                    <rect width="100" height="100" fill="url(#map-grid)" />
                  </svg>
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30">
                      <MapPin className="h-6 w-6 text-primary-foreground" />
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-card/95 p-3 shadow-lg backdrop-blur-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{product.location}</p>
                        <p className="text-sm text-muted-foreground">Exact location after booking</p>
                      </div>
                    </div>

                    <Button size="sm" variant="outline" className="shrink-0 gap-1.5 rounded-lg">
                      <Navigation className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Directions</span>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="hidden lg:col-span-5 lg:block">
            <div className="sticky top-24">
              <aside className="rounded-2xl border border-border/50 bg-card p-6 shadow-lg">
                {hasBuyPrice && (
                  <div className="mb-6 flex items-baseline gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium uppercase tracking-wide text-primary">
                      Buy Price
                    </span>
                    <span className="text-3xl font-bold text-foreground">{formatPrice(product.price!)}</span>
                  </div>
                )}

                {hasRentalPricing && (
                  <>
                    <div className="mb-6 grid grid-cols-2 gap-2">
                      {availablePricing.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedPricing(option.id)}
                          className={cn(
                            'relative rounded-xl border-2 p-3 text-left transition-all duration-200',
                            selectedOption?.id === option.id
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border/50 hover:border-border hover:bg-accent/45'
                          )}
                        >
                          <p className="text-xs font-medium text-muted-foreground">{option.label}</p>
                          <p className={cn('text-lg font-bold', selectedOption?.id === option.id ? 'text-primary' : 'text-foreground')}>
                            {formatPrice(option.price)}
                            <span className="text-sm font-normal text-muted-foreground">{option.suffix}</span>
                          </p>
                          {selectedOption?.id === option.id && (
                            <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="mb-6 grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rent From</span>
                        <div className="relative mt-1.5">
                          <input
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="w-full rounded-xl border border-border/50 bg-accent/45 px-3 py-2.5 text-sm font-medium transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rent To</span>
                        <div className="relative mt-1.5">
                          <input
                            type="date"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                            className="w-full rounded-xl border border-border/50 bg-accent/45 px-3 py-2.5 text-sm font-medium transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </label>
                    </div>

                    <div className="mb-6 space-y-3 border-y border-border/50 py-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {selectedOption ? `${formatPrice(selectedOption.price)} x ${Math.max(1, totalUnits)} ${selectedOption.id}` : 'Pricing unavailable'}
                        </span>
                        <span className="font-medium">{formatPrice(subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          Service fee
                          <Info className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-medium">{formatPrice(serviceFee)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <span className="font-semibold">Total</span>
                        <span className="text-xl font-bold">{formatPrice(total)}</span>
                      </div>
                    </div>
                  </>
                )}

                <Button className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-primary/90 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:from-primary/95 hover:to-primary/85 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]">
                  {hasRentalPricing ? 'Reserve' : 'Contact Seller'}
                </Button>

                {hasRentalPricing && (
                  <p className="mt-3 text-center text-sm text-muted-foreground">You won&apos;t be charged yet</p>
                )}

                <div className="mt-4 flex items-center gap-2 rounded-xl bg-accent/45 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-xs">
                    <p className="font-medium text-foreground">Protected by RentHour Guarantee</p>
                    <p className="text-muted-foreground">Full refund if item not as described</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Response time: within a few hours</span>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>

      {hasRentalPricing && selectedOption && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/95 p-4 backdrop-blur-md lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{selectedOption.label} rate</p>
              <p className="text-xl font-bold text-foreground">
                {formatPrice(selectedOption.price)}
                <span className="text-sm font-normal text-muted-foreground">{selectedOption.suffix}</span>
              </p>
            </div>
            <button className="flex-1 rounded-xl bg-gradient-to-r from-primary to-primary/90 px-6 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]">
              Reserve Now
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
