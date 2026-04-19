'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
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
  X,
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
  Loader2,
  Video,
} from 'lucide-react';

import MarketplaceHeader from '@/components/marketplace/MarketplaceHeader';
import { cn } from '@/lib/utils';
import { CATEGORIES } from '@/data/mockData';
import type { ListingProductPayload } from '@/data/listings';
import { formatPrice, type RentDuration } from '@/data/marketplaceData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useWishlistBootstrap } from '@/hooks/use-wishlist';
import { resolveProfileAvatarUrl } from '@/lib/profile-avatar';
import { getProductHref } from '@/lib/product-url';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  selectIsWishlisted,
  selectWishlistPendingIds,
  toggleWishlistOnServer,
} from '@/store/slices/wishlistSlice';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import ReportActionButton from '@/components/marketplace/ReportActionButton';

const PostListingFlowDialog = dynamic(
  () => import('@/components/marketplace/PostListingFlowDialog'),
  { ssr: false }
);

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

function timeStringToMinutes(timeValue: string) {
  const [hoursPart, minutesPart] = timeValue.split(':');
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function getDurationUnitLabel(duration: RentDuration, units: number) {
  if (duration === 'hourly') {
    return units === 1 ? 'hour' : 'hours';
  }

  if (duration === 'daily') {
    return units === 1 ? 'day' : 'days';
  }

  if (duration === 'weekly') {
    return units === 1 ? 'week' : 'weeks';
  }

  return units === 1 ? 'month' : 'months';
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
    return null;
  }

  if (distance === 0) {
    return '0 km away';
  }

  return `${distance.toFixed(1)} km away`;
}

function formatVideoDurationLabel(seconds: number | undefined) {
  if (!Number.isFinite(seconds) || seconds == null || seconds <= 0) {
    return null;
  }

  const rounded = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatVideoSizeLabel(bytes: number | undefined) {
  if (!Number.isFinite(bytes) || bytes == null || bytes <= 0) {
    return null;
  }

  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
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

type ListingReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  isCurrentUser: boolean;
  reviewer: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

type ReviewsAuthState = {
  isAuthenticated: boolean;
  isOwner: boolean;
  hasReviewed: boolean;
  canSubmitReview: boolean;
};

type ReviewSummary = {
  reviewCount: number;
  averageRating: number | null;
  ratingBreakdown: {
    '1': number;
    '2': number;
    '3': number;
    '4': number;
    '5': number;
  };
};

const EMPTY_REVIEW_SUMMARY: ReviewSummary = {
  reviewCount: 0,
  averageRating: null,
  ratingBreakdown: {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
  },
};

const EMPTY_REVIEW_AUTH: ReviewsAuthState = {
  isAuthenticated: false,
  isOwner: false,
  hasReviewed: false,
  canSubmitReview: false,
};

function formatReviewDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Recently';
  }

  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ProductDetailClient({ product }: { product: ListingProductPayload }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  useWishlistBootstrap();
  const liked = useAppSelector((state) => selectIsWishlisted(state, product.id));
  const wishlistPendingIds = useAppSelector(selectWishlistPendingIds);
  const isUpdatingWishlist = wishlistPendingIds.includes(product.id);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const openingRef = useRef(false);
  const [headerLocation, setHeaderLocation] = useState<string | null>(null);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [isPostFlowOpen, setIsPostFlowOpen] = useState(false);
  const [reviews, setReviews] = useState<ListingReview[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary>(EMPTY_REVIEW_SUMMARY);
  const [reviewAuth, setReviewAuth] = useState<ReviewsAuthState>(EMPTY_REVIEW_AUTH);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const images = product.images.length > 0 ? product.images : [product.image];
  const productHref = getProductHref(product);
  const distanceLabel = getDistanceLabel(product.distance);
  const currentImage = images[activeImageIndex] ?? images[0];
  const hasListingVideo = Boolean(product.videoUrl && product.videoUrl.trim().length > 0);
  const listingVideoDurationLabel = formatVideoDurationLabel(product.videoDurationSeconds);
  const listingVideoSizeLabel = formatVideoSizeLabel(product.videoSizeBytes);

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
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

  const selectedOption =
    availablePricing.find((option) => option.id === selectedPricing) ?? availablePricing[0] ?? null;

  const isHourlySelected = selectedOption?.id === 'hourly';

  const hourlyUnits = useMemo(() => {
    if (!isHourlySelected) {
      return 0;
    }

    const fromMinutes = timeStringToMinutes(startTime);
    const toMinutes = timeStringToMinutes(endTime);

    if (fromMinutes == null || toMinutes == null || toMinutes <= fromMinutes) {
      return 0;
    }

    return Math.max(1, Math.ceil((toMinutes - fromMinutes) / 60));
  }, [isHourlySelected, startTime, endTime]);

  const isHourlyTimeRangeValid = !isHourlySelected || hourlyUnits > 0;

  const totalUnits = useMemo(() => {
    if (!selectedOption) {
      return 0;
    }

    if (selectedOption.id === 'hourly') {
      return hourlyUnits;
    }

    const from = new Date(`${startDate}T00:00:00`);
    const to = new Date(`${endDate}T00:00:00`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return 1;
    }

    const totalDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_IN_MS));

    if (selectedOption.id === 'weekly') {
      return Math.ceil(totalDays / 7);
    }

    if (selectedOption.id === 'monthly') {
      return Math.ceil(totalDays / 30);
    }

    return totalDays;
  }, [selectedOption, startDate, endDate, hourlyUnits]);

  const billableUnits = selectedOption
    ? selectedOption.id === 'hourly'
      ? Math.max(0, totalUnits)
      : Math.max(1, totalUnits)
    : 0;
  const subtotal = selectedOption ? selectedOption.price * billableUnits : 0;
  const serviceFee = Math.round(subtotal * 0.1);
  const total = subtotal + serviceFee;

  const hasBuyPrice =
    (product.type === 'sell' || product.type === 'both') && typeof product.price === 'number';
  const hasRentalPricing =
    (product.type === 'rent' || product.type === 'both') && availablePricing.length > 0;
  const canReserve = !hasRentalPricing || isHourlyTimeRangeValid;

  const categoryLabel = CATEGORIES.find((category) => category.id === product.category)?.label ?? 'Listing';
  const postedLabel = formatPostedAgo(product.postedAt);
  const ownerDisplayName = product.ownerName || 'User';
  const ownerIsVerified = Boolean(product.ownerIsVerified);
  const ownerAvatarUrl = resolveProfileAvatarUrl(product.ownerImage);
  const ownerProfileHref = product.ownerId ? `/profile/${product.ownerId}` : null;
  const sellerIdentityContent = (
    <>
      <div className="relative">
        <Avatar className="h-14 w-14 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
          <AvatarImage src={ownerAvatarUrl} />
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
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-sm',
            ownerIsVerified ? 'text-green-600' : 'text-amber-600'
          )}
        >
          {ownerIsVerified ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Shield className="h-3.5 w-3.5" />
          )}
          {ownerIsVerified ? 'Verified Seller' : 'Not Verified'}
        </div>
        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Usually responds within 1 hour
        </div>
      </div>
    </>
  );

  const listingDescription =
    product.description ||
    `${product.title} is available in ${product.location}. Contact the seller to confirm details, accessory availability, and pickup preferences.`;
  const canTruncateDescription = listingDescription.length > 300;
  const visibleDescription =
    isDescriptionExpanded || !canTruncateDescription
      ? listingDescription
      : `${listingDescription.slice(0, 300)}...`;
  const encodedLocationQuery = encodeURIComponent(product.location);
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodedLocationQuery}&output=embed`;
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocationQuery}`;

  const handleNextImage = useCallback(() => {
    setActiveImageIndex((current) => (current + 1) % images.length);
  }, [images.length]);

  const handlePreviousImage = useCallback(() => {
    setActiveImageIndex((current) => (current - 1 + images.length) % images.length);
  }, [images.length]);

  const openImageViewer = (index?: number) => {
    if (typeof index === 'number') {
      const normalizedIndex = ((index % images.length) + images.length) % images.length;
      setActiveImageIndex(normalizedIndex);
    }

    setIsImageViewerOpen(true);
  };

  useEffect(() => {
    if (!isImageViewerOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsImageViewerOpen(false);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePreviousImage();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNextImage();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isImageViewerOpen, handleNextImage, handlePreviousImage]);

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : productHref;

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

    router.push('/');
  };

  const reserveMessage = useMemo(() => {
    const intro = `Hi ${ownerDisplayName}, I want to reserve \"${product.title}\".`;

    if (!hasRentalPricing || !selectedOption) {
      return `${intro} Is it still available?`;
    }

    const unitLabel = getDurationUnitLabel(selectedOption.id, billableUnits || 1);
    const rentalWindow =
      selectedOption.id === 'hourly'
        ? `Requested slot: ${startDate} from ${startTime} to ${endTime}.`
        : `Requested period: ${startDate} to ${endDate}.`;

    return `${intro} ${rentalWindow} Plan: ${selectedOption.label} (${billableUnits} ${unitLabel}). Estimated total: ${formatPrice(total)}. Is this available?`;
  }, [
    billableUnits,
    endDate,
    endTime,
    hasRentalPricing,
    ownerDisplayName,
    product.title,
    selectedOption,
    startDate,
    startTime,
    total,
  ]);

  const handleMessageSeller = async (initialMessage?: string) => {
    if (!product.ownerId) {
      toast({
        title: 'Seller unavailable',
        description: 'This listing does not have a valid seller account yet.',
        variant: 'destructive',
      });
      return;
    }

    setIsOpeningChat(true);

    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: product.ownerId,
          postId: product.id,
          ...(initialMessage?.trim() ? { initialMessage: initialMessage.trim() } : {}),
        }),
      });

      const payload = (await response.json()) as {
        conversation?: { id: string };
        error?: string;
      };

      if (response.status === 401) {
        router.push('/login?next=/messages');
        return;
      }

      if (!response.ok || !payload.conversation?.id) {
        throw new Error(payload.error || 'Unable to start chat right now.');
      }

      router.push(`/messages?conversation=${encodeURIComponent(payload.conversation.id)}`);
    } catch (error) {
      toast({
        title: 'Could not open chat',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to open seller chat right now.',
        variant: 'destructive',
      });
    } finally {
      setIsOpeningChat(false);
    }
  };

  const [isAdmin, setIsAdmin] = useState(false);
  const [confirmingAdminDelete, setConfirmingAdminDelete] = useState(false);
  const adminDeleteConfirmTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const res = await fetch('/api/admin/is-admin');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) setIsAdmin(Boolean(json?.isAdmin));
      } catch {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (adminDeleteConfirmTimeoutRef.current) {
        window.clearTimeout(adminDeleteConfirmTimeoutRef.current);
        adminDeleteConfirmTimeoutRef.current = null;
      }
    };
  }, []);

  const handleAdminDeleteListing = async () => {
    if (!confirmingAdminDelete) {
      setConfirmingAdminDelete(true);

      if (adminDeleteConfirmTimeoutRef.current) {
        window.clearTimeout(adminDeleteConfirmTimeoutRef.current);
      }

      adminDeleteConfirmTimeoutRef.current = window.setTimeout(() => {
        setConfirmingAdminDelete(false);
        adminDeleteConfirmTimeoutRef.current = null;
      }, 3000);

      toast({
        title: 'Confirm deletion',
        description: 'Click delete again within 3 seconds to permanently remove this listing.',
        variant: 'destructive',
      });

      return;
    }

    setConfirmingAdminDelete(false);
    if (adminDeleteConfirmTimeoutRef.current) {
      window.clearTimeout(adminDeleteConfirmTimeoutRef.current);
      adminDeleteConfirmTimeoutRef.current = null;
    }

    try {
      const res = await fetch(`/api/listings/${product.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'Unable to delete listing.');

      toast({ title: 'Listing deleted', description: 'The listing has been removed.' });
      router.push('/');
    } catch (error) {
      toast({ title: 'Could not delete', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  };

  const handleReserve = () => {
    if (!canReserve) {
      return;
    }

    startChatGuarded(reserveMessage);
  };

  const startChatGuarded = (initialMessage?: string) => {
    if (!product.ownerId || openingRef.current || isOpeningChat) {
      return;
    }

    openingRef.current = true;
    const p = handleMessageSeller(initialMessage);
    Promise.resolve(p).finally(() => {
      openingRef.current = false;
    });
  };

  const handleHeaderManualLocation = useCallback((city: string) => {
    setHeaderLocation(city.trim() || null);
  }, []);

  const handleHeaderRequestLocation = useCallback(() => {
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
            const displayValue = [city, state].filter(Boolean).join(', ');

            setHeaderLocation(
              displayValue || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`
            );
          } catch {
            setHeaderLocation(`${latitude.toFixed(3)}, ${longitude.toFixed(3)}`);
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
  }, []);

  const loadReviews = useCallback(async () => {
    setIsLoadingReviews(true);
    setReviewsError(null);

    try {
      const response = await fetch(`/api/listings/${product.id}/reviews`, {
        cache: 'no-store',
        credentials: 'include',
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            reviews?: ListingReview[];
            summary?: ReviewSummary;
            auth?: ReviewsAuthState;
            error?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to load reviews right now.');
      }

      setReviews(payload?.reviews ?? []);
      setReviewSummary(payload?.summary ?? EMPTY_REVIEW_SUMMARY);
      setReviewAuth(payload?.auth ?? EMPTY_REVIEW_AUTH);
    } catch (error) {
      setReviewsError(
        error instanceof Error ? error.message : 'Unable to load reviews right now.'
      );
      setReviewSummary(EMPTY_REVIEW_SUMMARY);
      setReviewAuth(EMPTY_REVIEW_AUTH);
      setReviews([]);
    } finally {
      setIsLoadingReviews(false);
    }
  }, [product.id]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const currentUserReview = useMemo(
    () => reviews.find((review) => review.isCurrentUser) ?? null,
    [reviews]
  );

  const handleSubmitReview = async () => {
    if (isSubmittingReview) {
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      toast({
        title: 'Select a rating',
        description: 'Choose a star rating before submitting your review.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingReview(true);

    try {
      const response = await fetch(`/api/listings/${product.id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
          }
        | null;

      if (response.status === 401) {
        const nextPath = productHref;
        router.push(`/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to submit review right now.');
      }

      toast({
        title: 'Review submitted',
        description: 'Your rating and review have been posted.',
      });

      setReviewRating(0);
      setReviewComment('');
      await loadReviews();
      router.refresh();
    } catch (error) {
      toast({
        title: 'Could not submit review',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to submit review right now.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceHeader
        location={headerLocation}
        onRequestLocation={handleHeaderRequestLocation}
        onManualLocation={handleHeaderManualLocation}
        searchQuery={headerSearchQuery}
        onSearchChange={setHeaderSearchQuery}
        searchPageHref="/search"
        onAddPost={() => setIsPostFlowOpen(true)}
      />

      <header className="border-b border-border/50 bg-card/80 backdrop-blur-md">
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
              onClick={async () => {
                const result = await dispatch(
                  toggleWishlistOnServer({ productId: product.id, like: !liked })
                );

                if (toggleWishlistOnServer.rejected.match(result)) {
                  const description =
                    result.payload?.message || 'Please log in to save items.';

                  toast({
                    title: 'Could not update wishlist',
                    description,
                    variant: 'destructive',
                  });
                }
              }}
              disabled={isUpdatingWishlist}
              aria-busy={isUpdatingWishlist}
              className="group text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-foreground disabled:opacity-60"
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
          <Link href="/" className="p-1 text-muted-foreground transition-colors hover:text-foreground">
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
            {hasListingVideo && product.videoUrl ? (
              <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-[0_10px_22px_-18px_hsl(var(--foreground)/0.45)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Video className="h-4 w-4 text-primary" />
                    Listing video
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {listingVideoDurationLabel ?? 'Short clip'}
                    {listingVideoSizeLabel ? ` • ${listingVideoSizeLabel}` : ''}
                  </span>
                </div>
                <video
                  src={product.videoUrl}
                  controls
                  preload="metadata"
                  playsInline
                  className="aspect-video w-full bg-black"
                />
              </section>
            ) : null}

            <section className="space-y-3">
              <div
                role="button"
                tabIndex={0}
                onClick={() => openImageViewer()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openImageViewer();
                  }
                }}
                className="group relative aspect-[4/3] cursor-zoom-in overflow-hidden rounded-2xl bg-muted"
              >
                <Image
                  src={currentImage}
                  alt={product.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="object-contain p-2 sm:p-3 transition-transform duration-500 group-hover:scale-[1.01]"
                  priority
                  loading="eager"
                />

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePreviousImage();
                  }}
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-card group-hover:opacity-100"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5 text-foreground" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleNextImage();
                  }}
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-card group-hover:opacity-100"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5 text-foreground" />
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openImageViewer();
                  }}
                  className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-card/90 px-4 py-2 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-card group-hover:opacity-100"
                >
                  <Camera className="h-4 w-4" />
                  <span className="text-sm font-medium">View all {images.length} photos</span>
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openImageViewer();
                  }}
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
                      className="object-contain p-1"
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
                {distanceLabel ? <span className="text-sm">{distanceLabel}</span> : null}
              </div>
            </section>

            <section className="rounded-2xl border border-border/65 bg-card/95 p-5 shadow-[0_10px_22px_-18px_hsl(var(--foreground)/0.45)] transition-shadow duration-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                {ownerProfileHref ? (
                  <Link
                    href={ownerProfileHref}
                    className="-m-1 flex items-center gap-4 rounded-xl p-1 transition-colors hover:bg-accent/40"
                    aria-label={`View ${ownerDisplayName} profile`}
                  >
                    {sellerIdentityContent}
                  </Link>
                ) : (
                  <div className="flex items-center gap-4">{sellerIdentityContent}</div>
                )}

                {ownerProfileHref ? (
                  <Link href={ownerProfileHref}>
                    <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-foreground">
                      <span className="hidden sm:inline">View Profile</span>
                      <ChevronRight className="h-4 w-4 sm:ml-1" />
                    </Button>
                  </Link>
                ) : null}
              </div>

              <Button
                onClick={() => startChatGuarded()}
                disabled={isOpeningChat || !product.ownerId}
                className="mt-4 h-11 w-full gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isOpeningChat ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4" />
                )}
                {isOpeningChat ? 'Opening chat...' : 'Message'}
              </Button>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ReportActionButton
                  targetType="post"
                  targetId={product.id}
                  title="Report listing"
                  buttonLabel="Report Listing"
                  variant="outline"
                />
                  {isAdmin ? (
                    <Button variant="destructive" size="sm" onClick={() => void handleAdminDeleteListing()}>
                      Delete listing
                    </Button>
                  ) : null}
                {product.ownerId ? (
                  <ReportActionButton
                    targetType="user"
                    targetId={product.ownerId}
                    title="Report seller"
                    buttonLabel="Report Seller"
                    variant="outline"
                  />
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-border/65 bg-card/95 p-5 shadow-[0_10px_22px_-18px_hsl(var(--foreground)/0.45)]">
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

            <section className="rounded-2xl border border-border/65 bg-card/95 p-5 shadow-[0_10px_22px_-18px_hsl(var(--foreground)/0.45)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Ratings & Reviews</h2>
                  <div className="mt-2 flex items-center gap-2">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    <span className="text-base font-semibold text-foreground">
                      {reviewSummary.averageRating != null
                        ? reviewSummary.averageRating.toFixed(1)
                        : 'No ratings yet'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({reviewSummary.reviewCount} reviews)
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const key = String(stars) as keyof ReviewSummary['ratingBreakdown'];
                    const count = reviewSummary.ratingBreakdown[key] ?? 0;
                    const ratio =
                      reviewSummary.reviewCount > 0
                        ? Math.round((count / reviewSummary.reviewCount) * 100)
                        : 0;

                    return (
                      <div key={stars} className="flex items-center gap-2 text-sm">
                        <span className="w-2 text-muted-foreground">{stars}</span>
                        <Star className="h-3.5 w-3.5 fill-primary/80 text-primary" />
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                        <span className="w-7 text-right text-xs text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-4">
                  {isLoadingReviews ? (
                    <p className="text-sm text-muted-foreground">Loading reviews...</p>
                  ) : (
                    <>
                      {reviewAuth.canSubmitReview ? (
                        <div className="rounded-xl border border-border/60 bg-background/35 p-4">
                          <h3 className="text-sm font-semibold text-foreground">Write a review</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            You can submit one review for this listing.
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setReviewRating(value)}
                                className="rounded-md p-1 transition-colors hover:bg-accent"
                                aria-label={`Set rating ${value}`}
                              >
                                <Star
                                  className={cn(
                                    'h-5 w-5 transition-colors',
                                    reviewRating >= value
                                      ? 'fill-primary text-primary'
                                      : 'text-muted-foreground/70'
                                  )}
                                />
                              </button>
                            ))}
                            <span className="ml-1 text-xs text-muted-foreground">
                              {reviewRating > 0 ? `${reviewRating}/5` : 'Select rating'}
                            </span>
                          </div>

                          <div className="mt-3 space-y-2">
                            <Textarea
                              value={reviewComment}
                              onChange={(event) => setReviewComment(event.target.value)}
                              placeholder="Share your experience with this listing..."
                              maxLength={1000}
                              rows={4}
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {reviewComment.length}/1000
                              </span>
                              <Button
                                type="button"
                                onClick={() => void handleSubmitReview()}
                                disabled={isSubmittingReview || reviewRating === 0}
                                className="gap-2"
                              >
                                {isSubmittingReview ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Submitting...
                                  </>
                                ) : (
                                  'Submit review'
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : isLoadingReviews ? null : !reviewAuth.isAuthenticated ? (
                        <div className="rounded-xl border border-border/60 bg-background/35 p-4">
                          <p className="text-sm text-muted-foreground">
                            Log in to rate and review this listing.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-3"
                            onClick={() =>
                              router.push(
                                `/login?next=${encodeURIComponent(productHref)}`
                              )
                            }
                          >
                            Log in to review
                          </Button>
                        </div>
                      ) : reviewAuth.isOwner ? (
                        <div className="rounded-xl border border-border/60 bg-background/35 p-4">
                          <p className="text-sm text-muted-foreground">
                            You cannot review your own listing.
                          </p>
                        </div>
                      ) : currentUserReview ? (
                        <div className="rounded-xl border border-border/60 bg-background/35 p-4">
                          <p className="text-sm font-medium text-foreground">
                            You already reviewed this listing.
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            One review per user is allowed for each listing.
                          </p>
                        </div>
                      ) : null}

                      {reviewsError ? (
                        <p className="text-sm text-destructive">{reviewsError}</p>
                      ) : reviews.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No reviews yet. Be the first to review this listing.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {reviews.map((review) => (
                            <article
                              key={review.id}
                              className="rounded-xl border border-border/55 bg-background/30 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <Avatar className="h-9 w-9">
                                    <AvatarImage src={resolveProfileAvatarUrl(review.reviewer.avatarUrl)} />
                                    <AvatarFallback className="bg-primary/10 text-primary">
                                      {getOwnerInitials(review.reviewer.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-sm font-medium text-foreground">
                                      {review.reviewer.name}
                                      {review.isCurrentUser ? ' (You)' : ''}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatReviewDate(review.createdAt)}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((value) => (
                                    <Star
                                      key={`${review.id}-${value}`}
                                      className={cn(
                                        'h-4 w-4',
                                        review.rating >= value
                                          ? 'fill-primary text-primary'
                                          : 'text-muted-foreground/40'
                                      )}
                                    />
                                  ))}
                                </div>
                              </div>

                              {review.comment ? (
                                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                                  {review.comment}
                                </p>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border/65 bg-card/95 p-5 shadow-[0_10px_22px_-18px_hsl(var(--foreground)/0.45)]">
              <h2 className="mb-3 text-lg font-semibold text-foreground">Location</h2>

              <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border/60 bg-muted">
                <iframe
                  title={`Map for ${product.location}`}
                  src={mapEmbedUrl}
                  className="absolute inset-0 h-full w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/15 via-transparent to-transparent" />

                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/55 bg-card/95 p-3 shadow-lg backdrop-blur-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{product.location}</p>
                        <p className="text-sm text-muted-foreground">Exact location after booking</p>
                      </div>
                    </div>

                    <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5 rounded-lg">
                      <a href={directionsUrl} target="_blank" rel="noreferrer">
                        <Navigation className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Directions</span>
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="hidden lg:col-span-5 lg:block">
            <div className="sticky top-24">
              <aside className="space-y-4 rounded-2xl border border-border/70 bg-card/95 p-6 shadow-[0_18px_34px_-24px_hsl(var(--foreground)/0.45)]">
                {hasBuyPrice && (
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <div className="flex items-baseline gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium uppercase tracking-wide text-primary">
                        Buy Price
                      </span>
                      <span className="text-3xl font-bold text-foreground">{formatPrice(product.price!)}</span>
                    </div>
                  </div>
                )}

                {hasRentalPricing && (
                  <>
                    <div className="rounded-xl border border-border/60 bg-background/45 p-3">
                      <div className="grid grid-cols-2 gap-2">
                        {availablePricing.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setSelectedPricing(option.id)}
                            className={cn(
                              'relative rounded-xl border-2 p-3 text-left transition-all duration-200',
                              selectedOption?.id === option.id
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border/60 hover:border-border hover:bg-accent/45'
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
                    </div>

                    <div className="rounded-xl border border-border/60 bg-background/45 p-3">
                      {isHourlySelected ? (
                        <div className="space-y-3">
                          <label className="block">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reservation Date</span>
                            <div className="relative mt-1.5">
                              <input
                                type="date"
                                value={startDate}
                                onChange={(event) => setStartDate(event.target.value)}
                                className="w-full rounded-xl border border-border/60 bg-accent/45 px-3 py-2.5 text-sm font-medium transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                              <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            </div>
                          </label>

                          <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">From Time</span>
                              <div className="relative mt-1.5">
                                <input
                                  type="time"
                                  value={startTime}
                                  onChange={(event) => setStartTime(event.target.value)}
                                  className="w-full rounded-xl border border-border/60 bg-accent/45 px-3 py-2.5 text-sm font-medium transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <Clock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              </div>
                            </label>

                            <label className="block">
                              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">To Time</span>
                              <div className="relative mt-1.5">
                                <input
                                  type="time"
                                  value={endTime}
                                  min={startTime}
                                  onChange={(event) => setEndTime(event.target.value)}
                                  className="w-full rounded-xl border border-border/60 bg-accent/45 px-3 py-2.5 text-sm font-medium transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <Clock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              </div>
                            </label>
                          </div>

                          {!isHourlyTimeRangeValid && (
                            <p className="text-xs font-medium text-destructive">
                              Choose a valid time window. The end time must be later than the start time.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rent From</span>
                            <div className="relative mt-1.5">
                              <input
                                type="date"
                                value={startDate}
                                onChange={(event) => setStartDate(event.target.value)}
                                className="w-full rounded-xl border border-border/60 bg-accent/45 px-3 py-2.5 text-sm font-medium transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                                className="w-full rounded-xl border border-border/60 bg-accent/45 px-3 py-2.5 text-sm font-medium transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                              <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            </div>
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-xl border border-border/60 bg-background/35 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {selectedOption
                            ? `${formatPrice(selectedOption.price)} x ${billableUnits} ${getDurationUnitLabel(selectedOption.id, billableUnits)}`
                            : 'Pricing unavailable'}
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

                <Button
                  onClick={handleReserve}
                  disabled={!canReserve || isOpeningChat || !product.ownerId}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-primary/90 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:from-primary/95 hover:to-primary/85 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isOpeningChat
                    ? 'Opening chat...'
                    : hasRentalPricing
                      ? 'Reserve'
                      : 'Contact Seller'}
                </Button>

                {hasRentalPricing && (
                  <p className="mt-3 text-center text-sm text-muted-foreground">You won&apos;t be charged yet</p>
                )}

                <div className="mt-4 flex items-center gap-2 rounded-xl border border-border/60 bg-accent/45 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-xs">
                    <p className="font-medium text-foreground">Protected by RentHour Guarantee</p>
                    <p className="text-muted-foreground">Full refund if item not as described</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-4 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Response time: within a few hours</span>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
        <DialogContent
          hideCloseButton
          className="h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[1280px] rounded-2xl border border-border/70 bg-background p-0 shadow-2xl"
        >
          <DialogTitle className="sr-only">{product.title} image viewer</DialogTitle>

          <div className="flex h-full w-full flex-col">
            <div className="flex items-center justify-between border-b border-border/70 bg-background px-4 py-3 sm:px-6">
              <span className="text-sm font-semibold uppercase tracking-wide text-foreground">Images</span>

              <button
                type="button"
                onClick={() => setIsImageViewerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-accent"
                aria-label="Close image viewer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              <div className="relative flex-1 bg-[#f3f4f6]">
                {images.length > 1 ? (
                  <button
                    type="button"
                    onClick={handlePreviousImage}
                    className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-foreground shadow-md transition-colors hover:bg-white"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                ) : null}

                <div className="relative h-[58vh] min-h-[340px] w-full lg:h-full">
                  <Image
                    src={currentImage}
                    alt={`${product.title} image ${activeImageIndex + 1}`}
                    fill
                    sizes="(min-width: 1024px) 68vw, 92vw"
                    className="object-contain p-4 sm:p-7"
                    priority
                  />
                </div>

                {images.length > 1 ? (
                  <button
                    type="button"
                    onClick={handleNextImage}
                    className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-foreground shadow-md transition-colors hover:bg-white"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                ) : null}

                <div className="absolute bottom-4 left-4 z-20 rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
                  {activeImageIndex + 1} / {images.length}
                </div>
              </div>

              <aside className="w-full shrink-0 border-t border-border/70 bg-background p-4 lg:w-[340px] lg:border-l lg:border-t-0 lg:p-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold leading-snug text-foreground">{product.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {categoryLabel} · {product.location}
                  </p>
                </div>

                {images.length > 1 ? (
                  <div className="mt-5">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Gallery
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {images.map((image, index) => (
                        <button
                          key={`${image}-fullscreen-${index}`}
                          type="button"
                          onClick={() => setActiveImageIndex(index)}
                          className={cn(
                            'relative aspect-square overflow-hidden rounded-md border transition-all',
                            index === activeImageIndex
                              ? 'border-primary ring-2 ring-primary/40'
                              : 'border-border/70 hover:border-primary/50'
                          )}
                          aria-label={`View image ${index + 1}`}
                        >
                          <Image
                            src={image}
                            alt={`${product.title} fullscreen thumbnail ${index + 1}`}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
            <button
              type="button"
              onClick={handleReserve}
              disabled={!canReserve || isOpeningChat || !product.ownerId}
              className="flex-1 rounded-xl bg-gradient-to-r from-primary to-primary/90 px-6 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isOpeningChat ? 'Opening chat...' : 'Reserve Now'}
            </button>
          </div>
        </div>
      )}

      {isPostFlowOpen ? (
        <PostListingFlowDialog open={isPostFlowOpen} onOpenChange={setIsPostFlowOpen} />
      ) : null}

    </div>
  );
}
