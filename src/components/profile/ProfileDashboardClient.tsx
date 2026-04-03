'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Share2,
  Heart,
  User,
  CreditCard,
  Bell,
  Shield,
  CircleHelp,
  LogOut,
  ChevronRight,
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
  MessageCircle,
  MoreVertical,
  Pencil,
  Loader2,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import PostListingFlowDialog from '@/components/marketplace/PostListingFlowDialog';
import ProductCard from '@/components/marketplace/ProductCard';
import type { Product, RentDuration } from '@/data/marketplaceData';
import { formatPrice, formatTimeAgo } from '@/data/marketplaceData';
import { toast } from '@/hooks/use-toast';
import { useWishlistBootstrap, useHydrateWishlist } from '@/hooks/use-wishlist';
import { useSupabaseAuth } from '@/lib/supabase-auth';
import {
  getDefaultProfileAvatarUrl,
  resolveProfileAvatarUrl,
} from '@/lib/profile-avatar';
import { cn } from '@/lib/utils';

type TabKey = 'listings' | 'bookings' | 'wishlist' | 'settings';

type ProfileDashboardClientProps = {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  cityLabel: string;
  joinedLabel: string;
  products: Product[];
  wishlistProducts: Product[];
  initialPostFlowOpen?: boolean;
};

type AvatarUploadResponse = {
  avatarUrl?: string | null;
  error?: string;
};

type ListingEditForm = {
  productId: string;
  title: string;
  description: string;
  location: string;
  sellPrice: string;
  rentDailyPrice: string;
  featured: boolean;
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

function getProductPriceParts(product: Product): { value: string; suffix: string | null } {
  if ((product.type === 'rent' || product.type === 'both') && product.rentPrices) {
    const rentPrice = getPrimaryRentPrice(product);
    if (rentPrice != null) {
      return {
        value: formatPrice(rentPrice),
        suffix: '/day',
      };
    }
  }

  if (product.price != null) {
    return {
      value: formatPrice(product.price),
      suffix: null,
    };
  }

  return {
    value: 'Price on request',
    suffix: null,
  };
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

function getDistanceSummary(distance: number) {
  if (!Number.isFinite(distance) || distance < 0) {
    return null;
  }

  if (distance === 0) {
    return '0 km';
  }

  return `${distance.toFixed(1)} km`;
}

function getTabIcon(tab: TabKey) {
  if (tab === 'listings') return Package;
  if (tab === 'bookings') return Calendar;
  if (tab === 'wishlist') return Heart;
  return Settings;
}

const DEFAULT_WISHLIST_RENT_DURATIONS: RentDuration[] = ['hourly', 'daily', 'weekly', 'monthly'];

export default function ProfileDashboardClient({
  displayName,
  email,
  avatarUrl,
  cityLabel,
  joinedLabel,
  products,
  wishlistProducts,
  initialPostFlowOpen = false,
}: ProfileDashboardClientProps) {
  const router = useRouter();
  const { status: authStatus, signOut } = useSupabaseAuth();
  useWishlistBootstrap();
  useHydrateWishlist(wishlistProducts.map((product) => product.id));
  const defaultProfileAvatarUrl = getDefaultProfileAvatarUrl();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [listingItems, setListingItems] = useState<Product[]>(products);
  const [activeTab, setActiveTab] = useState<TabKey>('listings');
  const [postFlowOpen, setPostFlowOpen] = useState(initialPostFlowOpen);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string>(
    resolveProfileAvatarUrl(avatarUrl)
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isResettingAvatar, setIsResettingAvatar] = useState(false);
  const [availabilityById, setAvailabilityById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(products.map((product) => [product.id, product.isAvailable ?? true]))
  );
  const [savingAvailabilityId, setSavingAvailabilityId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<ListingEditForm | null>(null);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const editingProduct = useMemo(() => {
    if (!editingForm) {
      return null;
    }

    return listingItems.find((item) => item.id === editingForm.productId) ?? null;
  }, [editingForm, listingItems]);

  useEffect(() => {
    setListingItems(products);
    setAvailabilityById(
      Object.fromEntries(
        products.map((product) => [product.id, product.isAvailable ?? true])
      )
    );
  }, [products]);

  useEffect(() => {
    setProfileAvatarUrl(resolveProfileAvatarUrl(avatarUrl));
  }, [avatarUrl]);

  useEffect(() => {
    if (!initialPostFlowOpen) {
      return;
    }

    router.replace('/profile');
  }, [initialPostFlowOpen, router]);

  const totalListings = listingItems.length;
  const totalRentals = listingItems.filter(
    (product) => product.type === 'rent' || product.type === 'both'
  ).length;
  const totalReviews = listingItems.reduce((sum, product) => sum + (product.reviewCount ?? 0), 0);

  const averageRating = useMemo(() => {
    const ratingValues = listingItems
      .map((product) => product.rating)
      .filter((rating): rating is number => typeof rating === 'number');

    if (ratingValues.length === 0) {
      return 0;
    }

    const total = ratingValues.reduce((sum, rating) => sum + rating, 0);
    return total / ratingValues.length;
  }, [listingItems]);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'listings', label: 'My Posts' },
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

  const handleAvatarFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];
    event.currentTarget.value = '';

    if (!selectedFile || isUploadingAvatar || isResettingAvatar) {
      return;
    }

    const formData = new FormData();
    formData.append('avatar', selectedFile);

    setIsUploadingAvatar(true);

    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      const payload = (await response
        .json()
        .catch(() => null)) as AvatarUploadResponse | null;

      if (!response.ok || !payload?.avatarUrl) {
        throw new Error(
          payload?.error || 'Unable to update your profile image right now.'
        );
      }

      setProfileAvatarUrl(resolveProfileAvatarUrl(payload.avatarUrl));

      toast({
        title: 'Profile image updated',
        description: 'Your new profile image is now visible across your account.',
      });

      router.refresh();
    } catch (error) {
      toast({
        title: 'Could not update profile image',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarReset = async () => {
    if (isUploadingAvatar || isResettingAvatar) {
      return;
    }

    setIsResettingAvatar(true);

    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'DELETE',
      });

      const payload = (await response
        .json()
        .catch(() => null)) as AvatarUploadResponse | null;

      if (!response.ok) {
        throw new Error(
          payload?.error || 'Unable to reset your profile image right now.'
        );
      }

      setProfileAvatarUrl(resolveProfileAvatarUrl(payload?.avatarUrl));

      toast({
        title: 'Profile image reset',
        description: 'Your default profile image is now active.',
      });

      router.refresh();
    } catch (error) {
      toast({
        title: 'Could not reset profile image',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsResettingAvatar(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      if (authStatus === 'authenticated') {
        try {
          await signOut();
        } catch {
          // Continue to local logout cleanup even if provider sign-out fails.
        }
      }

      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
        });
      } catch {
        // Ignore network failures and continue redirecting out of the account area.
      }

      router.push('/login');
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSettingsItemClick = (itemKey: 'profile' | 'address' | 'payment' | 'notifications' | 'security' | 'support' | 'logout') => {
    if (itemKey === 'logout') {
      void handleLogout();
      return;
    }

    if (itemKey === 'profile') {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      toast({
        title: 'Profile details',
        description: 'You can update your avatar and account details from the profile section above.',
      });
      return;
    }

    const upcomingLabels: Record<'address' | 'payment' | 'notifications' | 'security' | 'support', string> = {
      address: 'Address management',
      payment: 'Payment methods',
      notifications: 'Notification preferences',
      security: 'Security settings',
      support: 'Help and support',
    };

    toast({
      title: `${upcomingLabels[itemKey]} coming soon`,
      description: 'This settings section is added and will be connected in the next update.',
    });
  };

  const toggleAvailability = async (productId: string) => {
    const currentAvailable = availabilityById[productId] ?? true;
    const nextAvailable = !currentAvailable;

    setAvailabilityById((current) => ({
      ...current,
      [productId]: nextAvailable,
    }));
    setSavingAvailabilityId(productId);

    try {
      const response = await fetch(
        `/api/listings/${encodeURIComponent(productId)}/availability`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ available: nextAvailable }),
        }
      );

      const payload = (await response.json().catch(() => null)) as
        | { available?: boolean; error?: string }
        | null;

      if (!response.ok) {
        setAvailabilityById((current) => ({
          ...current,
          [productId]: currentAvailable,
        }));

        toast({
          title: 'Could not update availability',
          description:
            (payload?.error as string) || 'Please try again in a moment.',
          variant: 'destructive',
        });
      } else if (typeof payload?.available === 'boolean') {
        setAvailabilityById((current) => ({
          ...current,
          [productId]: payload.available,
        }));

        setListingItems((items) =>
          items.map((item) =>
            item.id === productId ? { ...item, isAvailable: payload.available } : item
          )
        );

        router.refresh();
      }
    } catch {
      setAvailabilityById((current) => ({
        ...current,
        [productId]: currentAvailable,
      }));

      toast({
        title: 'Could not update availability',
        description: 'Please check your network and try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingAvailabilityId(null);
    }
  };

  const handleDeleteListing = async (productId: string) => {
    const confirmed = typeof window !== 'undefined' ? window.confirm('Delete this listing? This cannot be undone.') : false;
    if (!confirmed) {
      return;
    }

    setDeletingId(productId);

    try {
      const response = await fetch(`/api/listings/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; deleted?: boolean } | null;

      if (!response.ok) {
        toast({
          title: 'Could not delete listing',
          description: (payload?.error as string) || 'Please try again in a moment.',
          variant: 'destructive',
        });
        return;
      }

      setListingItems((items) => items.filter((item) => item.id !== productId));
      setAvailabilityById((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });

      toast({
        title: 'Listing deleted',
        description: 'Your listing has been removed.',
      });
    } catch {
      toast({
        title: 'Could not delete listing',
        description: 'Please check your network and try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const openEditDialog = (product: Product) => {
    setEditingForm({
      productId: product.id,
      title: product.title,
      description: product.description ?? '',
      location: product.location,
      sellPrice: product.price != null ? String(product.price) : '',
      rentDailyPrice:
        product.rentPrices?.daily != null
          ? String(product.rentPrices.daily)
          : '',
      featured: Boolean(product.featured),
    });
  };

  const handleSaveListingEdit = async () => {
    if (!editingForm) {
      return;
    }

    const title = editingForm.title.trim();
    const description = editingForm.description.trim();
    const location = editingForm.location.trim();

    if (title.length < 3) {
      toast({
        title: 'Title is too short',
        description: 'Title must be at least 3 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (description.length < 10) {
      toast({
        title: 'Description is too short',
        description: 'Description must be at least 10 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (location.length < 2) {
      toast({
        title: 'Location is required',
        description: 'Location must be at least 2 characters.',
        variant: 'destructive',
      });
      return;
    }

    setSavingEditId(editingForm.productId);

    try {
      const requestBody: {
        title: string;
        description: string;
        location: string;
        featured: boolean;
        sellPrice?: string;
        rentDailyPrice?: string;
      } = {
        title,
        description,
        location,
        featured: editingForm.featured,
      };

      if (editingProduct?.type === 'sell' || editingProduct?.type === 'both') {
        requestBody.sellPrice = editingForm.sellPrice;
      }

      if (editingProduct?.type === 'rent' || editingProduct?.type === 'both') {
        requestBody.rentDailyPrice = editingForm.rentDailyPrice;
      }

      const response = await fetch(
        `/api/listings/${encodeURIComponent(editingForm.productId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            listing?: {
              id: string;
              title: string;
              description: string;
              location: string;
              featured: boolean;
              price: number | null;
              rentPrices: {
                hourly: number | null;
                daily: number | null;
                weekly: number | null;
                monthly: number | null;
              } | null;
            };
          }
        | null;

      if (!response.ok || !payload?.listing) {
        toast({
          title: 'Could not update listing',
          description:
            (payload?.error as string) || 'Please try again in a moment.',
          variant: 'destructive',
        });
        return;
      }

      setListingItems((items) =>
        items.map((item) => {
          if (item.id !== payload.listing?.id) {
            return item;
          }

          return {
            ...item,
            title: payload.listing.title,
            description: payload.listing.description,
            location: payload.listing.location,
            featured: payload.listing.featured,
            price: payload.listing.price,
            rentPrices: payload.listing.rentPrices,
          };
        })
      );

      toast({
        title: 'Listing updated',
        description: 'Your listing details were saved.',
      });

      setEditingForm(null);
    } catch {
      toast({
        title: 'Could not update listing',
        description: 'Please check your network and try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingEditId(null);
    }
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
              Add Post
            </Button>

            <div className="flex items-center justify-center gap-1.5 pt-2">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground/70" />
              <span className="text-xs text-primary-foreground/70">Quick & easy setup</span>
            </div>
          </div>
        </div>

        {listingItems.map((product) => {
          const isAvailable = availabilityById[product.id] ?? product.isAvailable ?? true;
          const badge = getListingBadge(product);
          const isRent = product.type === 'rent' || product.type === 'both';
          const priceParts = getProductPriceParts(product);
          const distanceSummary = getDistanceSummary(product.distance);
          const locationSummary = distanceSummary
            ? `${product.location} · ${distanceSummary}`
            : product.location;

          return (
            <article
              key={product.id}
              onClick={() => router.push(`/product/${product.id}`)}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-border/55 bg-card shadow-[0_2px_10px_-8px_hsl(var(--foreground)/0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_20px_32px_-22px_hsl(var(--foreground)/0.5)]"
            >
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

                  <div
                    className="absolute right-3 top-3 z-10"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-card/90 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-card"
                          aria-label="Listing actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditDialog(product);
                          }}
                          disabled={savingEditId === product.id}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit info
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteListing(product.id);
                          }}
                          disabled={deletingId === product.id}
                          className="text-destructive focus:text-destructive"
                        >
                          Delete listing
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                      <Star className="h-4 w-4 fill-current text-primary/85" />
                      <span className="text-sm font-medium text-foreground">
                        {product.rating != null ? product.rating.toFixed(1) : 'No ratings'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({product.reviewCount ?? 0} reviews)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-primary">{priceParts.value}</span>
                    {priceParts.suffix && (
                      <span className="text-sm text-muted-foreground">{priceParts.suffix}</span>
                    )}
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
                    className="flex items-center justify-between gap-2 border-t border-border/50 pt-2"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <span className={cn('text-sm font-medium', isAvailable ? 'text-primary' : 'text-muted-foreground')}>
                      {isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isAvailable}
                        onCheckedChange={() => void toggleAvailability(product.id)}
                        disabled={savingAvailabilityId === product.id}
                        aria-busy={savingAvailabilityId === product.id}
                        className="data-[state=checked]:bg-primary"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      />
                    </div>
                  </div>
                </div>
              </article>
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
      if (wishlistProducts.length === 0) {
        return (
          <div className="rounded-2xl border border-border/50 bg-card p-12 text-center shadow-sm">
            <p className="text-muted-foreground">Items you&apos;ve saved will appear here</p>
          </div>
        );
      }

      return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {wishlistProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              rentDurations={DEFAULT_WISHLIST_RENT_DURATIONS}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
        {[
          {
            key: 'profile' as const,
            label: 'Profile',
            description: 'Edit your personal info',
            icon: User,
            destructive: false,
          },
          {
            key: 'address' as const,
            label: 'Address',
            description: 'Manage your addresses',
            icon: MapPin,
            destructive: false,
          },
          {
            key: 'payment' as const,
            label: 'Payment Methods',
            description: 'Bank & payment details',
            icon: CreditCard,
            destructive: false,
          },
          {
            key: 'notifications' as const,
            label: 'Notifications',
            description: 'Notification preferences',
            icon: Bell,
            destructive: false,
          },
          {
            key: 'security' as const,
            label: 'Security',
            description: 'Password & privacy',
            icon: Shield,
            destructive: false,
          },
          {
            key: 'support' as const,
            label: 'Help & Support',
            description: 'Contact us & FAQs',
            icon: CircleHelp,
            destructive: false,
          },
          {
            key: 'logout' as const,
            label: 'Logout',
            description: 'Sign out from your account',
            icon: LogOut,
            destructive: true,
          },
        ].map((item, index, array) => {
          const Icon = item.icon;
          const isLast = index === array.length - 1;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSettingsItemClick(item.key)}
              disabled={isLoggingOut}
              className={cn(
                'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-70 sm:px-6',
                !isLast && 'border-b border-border/55'
              )}
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                    item.destructive
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-primary/10 text-primary'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <p
                    className={cn(
                      'truncate text-[1.02rem] font-semibold',
                      item.destructive ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {item.label}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>

              {item.key === 'logout' && isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/75 shadow-[0_6px_16px_-14px_hsl(var(--foreground)/0.35)] backdrop-blur-md">
        <div className="mx-auto flex h-[62px] max-w-6xl items-center justify-between px-4 sm:px-6">
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
              onClick={() => router.push('/messages')}
              className="text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-foreground"
            >
              <MessageCircle className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Messages</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="group text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-foreground"
            >
              <Heart className="mr-1.5 h-4 w-4 transition-colors group-hover:fill-destructive/80 group-hover:text-destructive/90" />
              <span className="hidden sm:inline">Save</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
        <section className="mb-6 rounded-[1.35rem] border border-border/55 bg-card p-5 shadow-[0_8px_18px_-16px_hsl(var(--foreground)/0.45)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="group relative">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/30 via-accent/20 to-primary/30 blur-sm transition-all duration-300 group-hover:blur-md" />
                <div className="relative h-28 w-28 overflow-hidden rounded-full ring-[3px] ring-card shadow-lg">
                  <Image
                    src={profileAvatarUrl}
                    alt={displayName}
                    fill
                    className="object-cover"
                    onError={() => {
                      if (profileAvatarUrl !== defaultProfileAvatarUrl) {
                        setProfileAvatarUrl(defaultProfileAvatarUrl);
                      }
                    }}
                  />
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    void handleAvatarFileChange(event);
                  }}
                  disabled={isUploadingAvatar || isResettingAvatar}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar || isResettingAvatar}
                  className="absolute -bottom-1 -left-1 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                  aria-label="Edit profile image"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pencil className="h-4 w-4" />
                  )}
                </button>
                {profileAvatarUrl !== defaultProfileAvatarUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleAvatarReset();
                    }}
                    disabled={isUploadingAvatar || isResettingAvatar}
                    className="absolute -top-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-destructive text-destructive-foreground shadow transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-70"
                    aria-label="Reset profile image"
                    title="Reset to default"
                  >
                    {isResettingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
                <div className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-primary shadow-sm">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-primary-foreground" />
                </div>
              </div>

              <div className="space-y-3 text-center sm:text-left">
                <div>
                  <h1 className="text-[2.02rem] font-semibold leading-tight tracking-tight text-foreground">{displayName}</h1>

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
              <div className="group flex h-[7.25rem] w-[7.25rem] cursor-default flex-col items-center justify-center rounded-2xl border border-border/50 bg-accent/30 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/60 hover:shadow-md">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <span className="text-2xl font-bold text-foreground">{totalListings}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">Total Listings</span>
              </div>

              <div className="group flex h-[7.25rem] w-[7.25rem] cursor-default flex-col items-center justify-center rounded-2xl border border-border/50 bg-accent/30 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/60 hover:shadow-md">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                  <CalendarCheck className="h-5 w-5 text-primary" />
                </div>
                <span className="text-2xl font-bold text-foreground">{totalRentals}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">Total Rentals</span>
              </div>

              <div className="group flex h-[7.25rem] w-[7.25rem] cursor-default flex-col items-center justify-center rounded-2xl border border-border/50 bg-accent/30 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/60 hover:shadow-md">
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

        <div className="mb-6 border-b border-border/55 pb-1">
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

      <Dialog
        open={Boolean(editingForm)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !savingEditId) {
            setEditingForm(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit listing info</DialogTitle>
            <DialogDescription>
              Update your listing details. Changes are saved instantly.
            </DialogDescription>
          </DialogHeader>

          {editingForm && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="listing-title">Title</Label>
                <Input
                  id="listing-title"
                  value={editingForm.title}
                  onChange={(event) =>
                    setEditingForm((current) =>
                      current
                        ? {
                            ...current,
                            title: event.target.value,
                          }
                        : current
                    )
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="listing-description">Description</Label>
                <Textarea
                  id="listing-description"
                  value={editingForm.description}
                  onChange={(event) =>
                    setEditingForm((current) =>
                      current
                        ? {
                            ...current,
                            description: event.target.value,
                          }
                        : current
                    )
                  }
                  className="min-h-[110px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="listing-location">Location</Label>
                <Input
                  id="listing-location"
                  value={editingForm.location}
                  onChange={(event) =>
                    setEditingForm((current) =>
                      current
                        ? {
                            ...current,
                            location: event.target.value,
                          }
                        : current
                    )
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-accent/30 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">Feature this post</p>
                  <p className="text-xs text-muted-foreground">
                    Featured posts are highlighted in marketplace cards.
                  </p>
                </div>
                <Switch
                  checked={editingForm.featured}
                  onCheckedChange={(checked) =>
                    setEditingForm((current) =>
                      current
                        ? {
                            ...current,
                            featured: checked,
                          }
                        : current
                    )
                  }
                  disabled={Boolean(savingEditId)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {(editingProduct?.type === 'sell' || editingProduct?.type === 'both') && (
                <div className="space-y-1.5">
                  <Label htmlFor="listing-sell-price">Sell price (INR)</Label>
                  <Input
                    id="listing-sell-price"
                    inputMode="decimal"
                    value={editingForm.sellPrice}
                    onChange={(event) =>
                      setEditingForm((current) =>
                        current
                          ? {
                              ...current,
                              sellPrice: event.target.value,
                            }
                          : current
                      )
                    }
                  />
                </div>
              )}

              {(editingProduct?.type === 'rent' || editingProduct?.type === 'both') && (
                <div className="space-y-1.5">
                  <Label htmlFor="listing-rent-daily">Daily rent (INR)</Label>
                  <Input
                    id="listing-rent-daily"
                    inputMode="decimal"
                    value={editingForm.rentDailyPrice}
                    onChange={(event) =>
                      setEditingForm((current) =>
                        current
                          ? {
                              ...current,
                              rentDailyPrice: event.target.value,
                            }
                          : current
                      )
                    }
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingForm(null)}
              disabled={Boolean(savingEditId)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveListingEdit()}
              disabled={Boolean(savingEditId)}
            >
              {savingEditId ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PostListingFlowDialog open={postFlowOpen} onOpenChange={setPostFlowOpen} />
    </main>
  );
}
