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
import { getProductHref } from '@/lib/product-url';
import { cn } from '@/lib/utils';

type TabKey = 'listings' | 'bookings' | 'wishlist' | 'settings';

type SettingsItemKey =
  | 'profile'
  | 'address'
  | 'payment'
  | 'notifications'
  | 'security'
  | 'support'
  | 'logout';

type SettingsDialogKey = Exclude<SettingsItemKey, 'logout'>;

type ProfileDashboardClientProps = {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  isVerified: boolean;
  cityLabel: string;
  joinedLabel: string;
  products: Product[];
  wishlistProducts: Product[];
  initialTab?: TabKey;
  initialPostFlowOpen?: boolean;
};

type AvatarUploadResponse = {
  avatarUrl?: string | null;
  error?: string;
};

type ProfileDetailsResponse = {
  user?: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  error?: string;
};

type AddressItem = {
  id: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
  createdAt: string;
  updatedAt: string;
};

type AddressListResponse = {
  addresses?: AddressItem[];
  error?: string;
};

type AddressUpsertResponse = {
  address?: AddressItem;
  error?: string;
};

type AddressDeleteResponse = {
  success?: boolean;
  error?: string;
};

type AddressFormState = {
  id: string | null;
  address: string;
  state: string;
  city: string;
  pincode: string;
};

type PaymentMethod = {
  id: string;
  label: string;
  details: string;
  isDefault: boolean;
};

type PaymentMethodForm = {
  label: string;
  details: string;
  makeDefault: boolean;
};

type NotificationPreferences = {
  bookingUpdates: boolean;
  listingPerformance: boolean;
  securityAlerts: boolean;
  marketingEmails: boolean;
};

type SecurityFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type PasswordUpdateResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

const PAYMENT_METHODS_STORAGE_KEY = 'rh_profile_payment_methods';
const NOTIFICATION_PREFS_STORAGE_KEY = 'rh_profile_notification_preferences';

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  bookingUpdates: true,
  listingPerformance: true,
  securityAlerts: true,
  marketingEmails: false,
};

const EMPTY_ADDRESS_FORM: AddressFormState = {
  id: null,
  address: '',
  state: '',
  city: '',
  pincode: '',
};

const EMPTY_PAYMENT_FORM: PaymentMethodForm = {
  label: '',
  details: '',
  makeDefault: false,
};

const EMPTY_SECURITY_FORM: SecurityFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function parseStoredPaymentMethods(input: string | null): PaymentMethod[] {
  if (!input) {
    return [];
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (
          !item ||
          typeof item !== 'object' ||
          typeof (item as { id?: unknown }).id !== 'string' ||
          typeof (item as { label?: unknown }).label !== 'string' ||
          typeof (item as { details?: unknown }).details !== 'string'
        ) {
          return null;
        }

        return {
          id: (item as { id: string }).id,
          label: (item as { label: string }).label,
          details: (item as { details: string }).details,
          isDefault: Boolean((item as { isDefault?: unknown }).isDefault),
        } satisfies PaymentMethod;
      })
      .filter((item): item is PaymentMethod => Boolean(item));
  } catch {
    return [];
  }
}

function parseStoredNotificationPreferences(
  input: string | null
): NotificationPreferences {
  if (!input) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(input) as Partial<NotificationPreferences>;

    return {
      bookingUpdates:
        typeof parsed.bookingUpdates === 'boolean'
          ? parsed.bookingUpdates
          : DEFAULT_NOTIFICATION_PREFERENCES.bookingUpdates,
      listingPerformance:
        typeof parsed.listingPerformance === 'boolean'
          ? parsed.listingPerformance
          : DEFAULT_NOTIFICATION_PREFERENCES.listingPerformance,
      securityAlerts:
        typeof parsed.securityAlerts === 'boolean'
          ? parsed.securityAlerts
          : DEFAULT_NOTIFICATION_PREFERENCES.securityAlerts,
      marketingEmails:
        typeof parsed.marketingEmails === 'boolean'
          ? parsed.marketingEmails
          : DEFAULT_NOTIFICATION_PREFERENCES.marketingEmails,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

type ListingPurpose = 'sell' | 'rent';

type ListingEditStep = 'details' | 'purpose' | 'pricing' | 'location' | 'review';

type ListingEditForm = {
  productId: string;
  title: string;
  description: string;
  purposes: ListingPurpose[];
  sellPrice: string;
  rentPrices: Record<RentDuration, string>;
  locationLine1: string;
  locationCity: string;
  locationState: string;
  locationPincode: string;
  featured: boolean;
};

const EDIT_PURPOSE_OPTIONS: Array<{
  value: ListingPurpose;
  label: string;
  description: string;
}> = [
  {
    value: 'rent',
    label: 'Rent',
    description: 'List for hourly, daily, weekly, or monthly rental',
  },
  {
    value: 'sell',
    label: 'Sell',
    description: 'List for one-time purchase',
  },
];

const EDIT_RENT_DURATION_OPTIONS: Array<{ value: RentDuration; label: string }> = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const LOCATION_PINCODE_PATTERN = /^\d{6}$/;

const LISTING_EDIT_STEPS: Array<{
  key: ListingEditStep;
  label: string;
}> = [
  { key: 'details', label: 'Basic info' },
  { key: 'purpose', label: 'Purpose' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'location', label: 'Location' },
  { key: 'review', label: 'Review' },
];

function getEditPurposesFromProductType(type: Product['type']): ListingPurpose[] {
  if (type === 'both') {
    return ['rent', 'sell'];
  }

  return [type];
}

function parseListingLocationLabel(location: string) {
  const normalized = location.trim();
  if (!normalized || normalized.toLowerCase() === 'location not specified') {
    return {
      line1: '',
      city: '',
      state: '',
    };
  }

  const parts = normalized
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (parts.length >= 2) {
    const [city, ...stateParts] = parts;

    return {
      line1: normalized,
      city,
      state: stateParts.join(', '),
    };
  }

  return {
    line1: normalized,
    city: normalized,
    state: '',
  };
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
  isVerified,
  cityLabel,
  joinedLabel,
  products,
  wishlistProducts,
  initialTab = 'listings',
  initialPostFlowOpen = false,
}: ProfileDashboardClientProps) {
  const router = useRouter();
  const { status: authStatus, signOut } = useSupabaseAuth();
  useWishlistBootstrap();
  useHydrateWishlist(wishlistProducts.map((product) => product.id));
  const defaultProfileAvatarUrl = getDefaultProfileAvatarUrl();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [listingItems, setListingItems] = useState<Product[]>(products);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
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
  const [listingEditStep, setListingEditStep] = useState<ListingEditStep>('details');
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState<SettingsDialogKey | null>(null);

  const [profileDisplayName, setProfileDisplayName] = useState(displayName);
  const [profileFormName, setProfileFormName] = useState(displayName);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [addressForm, setAddressForm] = useState<AddressFormState>(EMPTY_ADDRESS_FORM);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [confirmAddressDeleteId, setConfirmAddressDeleteId] = useState<string | null>(null);
  const [confirmListingDeleteId, setConfirmListingDeleteId] = useState<string | null>(null);
  const addressDeleteConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listingDeleteConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodForm, setPaymentMethodForm] = useState<PaymentMethodForm>(
    EMPTY_PAYMENT_FORM
  );

  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);

  const [securityForm, setSecurityForm] = useState<SecurityFormState>(
    EMPTY_SECURITY_FORM
  );
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    setListingItems(products);
    setAvailabilityById(
      Object.fromEntries(
        products.map((product) => [product.id, product.isAvailable ?? true])
      )
    );
  }, [products]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setProfileAvatarUrl(resolveProfileAvatarUrl(avatarUrl));
  }, [avatarUrl]);

  useEffect(() => {
    setProfileDisplayName(displayName);
    setProfileFormName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setPaymentMethods(
      parseStoredPaymentMethods(
        window.localStorage.getItem(PAYMENT_METHODS_STORAGE_KEY)
      )
    );
    setNotificationPreferences(
      parseStoredNotificationPreferences(
        window.localStorage.getItem(NOTIFICATION_PREFS_STORAGE_KEY)
      )
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      PAYMENT_METHODS_STORAGE_KEY,
      JSON.stringify(paymentMethods)
    );
  }, [paymentMethods]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      NOTIFICATION_PREFS_STORAGE_KEY,
      JSON.stringify(notificationPreferences)
    );
  }, [notificationPreferences]);

  useEffect(() => {
    if (!initialPostFlowOpen) {
      return;
    }

    router.replace('/profile');
  }, [initialPostFlowOpen, router]);

  useEffect(() => {
    return () => {
      if (addressDeleteConfirmTimeoutRef.current) {
        clearTimeout(addressDeleteConfirmTimeoutRef.current);
        addressDeleteConfirmTimeoutRef.current = null;
      }

      if (listingDeleteConfirmTimeoutRef.current) {
        clearTimeout(listingDeleteConfirmTimeoutRef.current);
        listingDeleteConfirmTimeoutRef.current = null;
      }
    };
  }, []);

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

  const settingsDialogTitleMap: Record<SettingsDialogKey, string> = {
    profile: 'Profile',
    address: 'Address',
    payment: 'Payment Methods',
    notifications: 'Notifications',
    security: 'Security',
    support: 'Help & Support',
  };

  const settingsDialogDescriptionMap: Record<SettingsDialogKey, string> = {
    profile: 'Update your personal account details.',
    address: 'Add, edit, and remove your saved addresses.',
    payment: 'Manage your preferred payment methods on this device.',
    notifications: 'Choose which alerts and updates you receive.',
    security: 'Update your account password and security details.',
    support: 'Get support and quick links to legal/help pages.',
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/');
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

  const resetAddressForm = () => {
    setAddressForm(EMPTY_ADDRESS_FORM);
  };

  const loadAddresses = async () => {
    setIsLoadingAddresses(true);

    try {
      const response = await fetch('/api/addresses', {
        method: 'GET',
      });

      const payload = (await response
        .json()
        .catch(() => null)) as AddressListResponse | null;

      if (!response.ok || !Array.isArray(payload?.addresses)) {
        throw new Error(payload?.error || 'Unable to fetch your addresses right now.');
      }

      setAddresses(payload.addresses);
    } catch (error) {
      toast({
        title: 'Could not load addresses',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  const handleSaveProfile = async () => {
    const normalizedName = profileFormName.trim().replace(/\s+/g, ' ');

    if (normalizedName.length > 0 && normalizedName.length < 2) {
      toast({
        title: 'Name is too short',
        description: 'Name must be at least 2 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (normalizedName.length > 80) {
      toast({
        title: 'Name is too long',
        description: 'Name must be 80 characters or less.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingProfile(true);

    try {
      const response = await fetch('/api/profile/details', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: normalizedName || null }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as ProfileDetailsResponse | null;

      if (!response.ok || !payload?.user) {
        throw new Error(payload?.error || 'Unable to update your profile.');
      }

      const nextDisplayName =
        payload.user.name?.trim() || payload.user.email.split('@')[0] || 'User';

      setProfileDisplayName(nextDisplayName);
      setProfileFormName(nextDisplayName);

      toast({
        title: 'Profile updated',
        description: 'Your display name has been saved.',
      });

      setSettingsDialog(null);
      router.refresh();
    } catch (error) {
      toast({
        title: 'Could not update profile',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAddressEdit = (address: AddressItem) => {
    setAddressForm({
      id: address.id,
      address: address.address,
      state: address.state,
      city: address.city,
      pincode: address.pincode,
    });
  };

  const handleAddressSave = async () => {
    const normalizedAddress = addressForm.address.trim().replace(/\s+/g, ' ');
    const normalizedState = addressForm.state.trim().replace(/\s+/g, ' ');
    const normalizedCity = addressForm.city.trim().replace(/\s+/g, ' ');
    const normalizedPincode = addressForm.pincode.trim();

    if (normalizedAddress.length < 5) {
      toast({
        title: 'Address is too short',
        description: 'Address must be at least 5 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (normalizedState.length < 2) {
      toast({
        title: 'State is required',
        description: 'State must be at least 2 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (normalizedCity.length < 2) {
      toast({
        title: 'City is required',
        description: 'City must be at least 2 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (!/^\d{6}$/.test(normalizedPincode)) {
      toast({
        title: 'Invalid pincode',
        description: 'Enter a valid 6-digit pincode.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingAddress(true);

    try {
      const endpoint = addressForm.id
        ? `/api/addresses/${encodeURIComponent(addressForm.id)}`
        : '/api/addresses';
      const method = addressForm.id ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: normalizedAddress,
          state: normalizedState,
          city: normalizedCity,
          pincode: normalizedPincode,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as AddressUpsertResponse | null;

      if (!response.ok || !payload?.address) {
        throw new Error(payload?.error || 'Unable to save this address.');
      }

      toast({
        title: addressForm.id ? 'Address updated' : 'Address added',
        description: 'Your address list is now up to date.',
      });

      resetAddressForm();
      await loadAddresses();
    } catch (error) {
      toast({
        title: 'Could not save address',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleAddressDelete = async (addressId: string) => {
    if (confirmAddressDeleteId !== addressId) {
      setConfirmAddressDeleteId(addressId);

      if (addressDeleteConfirmTimeoutRef.current) {
        clearTimeout(addressDeleteConfirmTimeoutRef.current);
      }

      addressDeleteConfirmTimeoutRef.current = setTimeout(() => {
        setConfirmAddressDeleteId(null);
        addressDeleteConfirmTimeoutRef.current = null;
      }, 3000);

      toast({
        title: 'Confirm address deletion',
        description: 'Click delete again within 3 seconds to remove this address.',
        variant: 'destructive',
      });

      return;
    }

    setConfirmAddressDeleteId(null);
    if (addressDeleteConfirmTimeoutRef.current) {
      clearTimeout(addressDeleteConfirmTimeoutRef.current);
      addressDeleteConfirmTimeoutRef.current = null;
    }

    setDeletingAddressId(addressId);

    try {
      const response = await fetch(`/api/addresses/${encodeURIComponent(addressId)}`, {
        method: 'DELETE',
      });

      const payload = (await response
        .json()
        .catch(() => null)) as AddressDeleteResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to delete this address.');
      }

      if (addressForm.id === addressId) {
        resetAddressForm();
      }

      setAddresses((current) => current.filter((item) => item.id !== addressId));

      toast({
        title: 'Address deleted',
        description: 'The address has been removed.',
      });
    } catch (error) {
      toast({
        title: 'Could not delete address',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setDeletingAddressId(null);
    }
  };

  const handleAddPaymentMethod = () => {
    const label = paymentMethodForm.label.trim().replace(/\s+/g, ' ');
    const details = paymentMethodForm.details.trim().replace(/\s+/g, ' ');

    if (label.length < 2) {
      toast({
        title: 'Method label is required',
        description: 'Please enter a short label (e.g. UPI, Bank Account).',
        variant: 'destructive',
      });
      return;
    }

    if (details.length < 4) {
      toast({
        title: 'Method details are incomplete',
        description: 'Please enter details like UPI ID or account reference.',
        variant: 'destructive',
      });
      return;
    }

    const nextMethod: PaymentMethod = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      label,
      details,
      isDefault: paymentMethods.length === 0 || paymentMethodForm.makeDefault,
    };

    setPaymentMethods((current) => {
      const withDefaultReset = nextMethod.isDefault
        ? current.map((item) => ({ ...item, isDefault: false }))
        : current;

      return [...withDefaultReset, nextMethod];
    });

    setPaymentMethodForm(EMPTY_PAYMENT_FORM);

    toast({
      title: 'Payment method saved',
      description: 'Your payment method was added for this browser.',
    });
  };

  const handleRemovePaymentMethod = (methodId: string) => {
    setPaymentMethods((current) => {
      const methodToDelete = current.find((item) => item.id === methodId) ?? null;
      const filtered = current.filter((item) => item.id !== methodId);

      if (methodToDelete?.isDefault && filtered.length > 0) {
        return filtered.map((item, index) => ({
          ...item,
          isDefault: index === 0,
        }));
      }

      return filtered;
    });
  };

  const handleSetDefaultPaymentMethod = (methodId: string) => {
    setPaymentMethods((current) =>
      current.map((item) => ({
        ...item,
        isDefault: item.id === methodId,
      }))
    );
  };

  const handleNotificationToggle = (
    key: keyof NotificationPreferences,
    value: boolean
  ) => {
    setNotificationPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleUpdatePassword = async () => {
    const currentPassword = securityForm.currentPassword;
    const newPassword = securityForm.newPassword;
    const confirmPassword = securityForm.confirmPassword;

    if (newPassword.length < 8) {
      toast({
        title: 'Password is too short',
        description: 'New password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Confirm password must match the new password.',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const response = await fetch('/api/profile/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as PasswordUpdateResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to update your password.');
      }

      setSecurityForm(EMPTY_SECURITY_FORM);

      toast({
        title: 'Password updated',
        description: payload.message || 'Your password has been updated successfully.',
      });

      setSettingsDialog(null);
    } catch (error) {
      toast({
        title: 'Could not update password',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSettingsItemClick = (itemKey: SettingsItemKey) => {
    if (itemKey === 'logout') {
      void handleLogout();
      return;
    }

    if (itemKey === 'profile') {
      setProfileFormName(profileDisplayName);
    }

    if (itemKey === 'address') {
      resetAddressForm();
      void loadAddresses();
    }

    if (itemKey === 'payment') {
      setPaymentMethodForm(EMPTY_PAYMENT_FORM);
    }

    if (itemKey === 'security') {
      setSecurityForm(EMPTY_SECURITY_FORM);
    }

    setSettingsDialog(itemKey);
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
    if (confirmListingDeleteId !== productId) {
      setConfirmListingDeleteId(productId);

      if (listingDeleteConfirmTimeoutRef.current) {
        clearTimeout(listingDeleteConfirmTimeoutRef.current);
      }

      listingDeleteConfirmTimeoutRef.current = setTimeout(() => {
        setConfirmListingDeleteId(null);
        listingDeleteConfirmTimeoutRef.current = null;
      }, 3000);

      toast({
        title: 'Confirm listing deletion',
        description: 'Click delete again within 3 seconds to permanently remove this listing.',
        variant: 'destructive',
      });

      return;
    }

    setConfirmListingDeleteId(null);
    if (listingDeleteConfirmTimeoutRef.current) {
      clearTimeout(listingDeleteConfirmTimeoutRef.current);
      listingDeleteConfirmTimeoutRef.current = null;
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
    const locationParts = parseListingLocationLabel(product.location);

    setListingEditStep('details');

    setEditingForm({
      productId: product.id,
      title: product.title,
      description: product.description ?? '',
      purposes: getEditPurposesFromProductType(product.type),
      sellPrice: product.price != null ? String(product.price) : '',
      rentPrices: {
        hourly:
          product.rentPrices?.hourly != null
            ? String(product.rentPrices.hourly)
            : '',
        daily:
          product.rentPrices?.daily != null
            ? String(product.rentPrices.daily)
            : '',
        weekly:
          product.rentPrices?.weekly != null
            ? String(product.rentPrices.weekly)
            : '',
        monthly:
          product.rentPrices?.monthly != null
            ? String(product.rentPrices.monthly)
            : '',
      },
      locationLine1: locationParts.line1,
      locationCity: locationParts.city,
      locationState: locationParts.state,
      locationPincode: '',
      featured: Boolean(product.featured),
    });
  };

  const toggleEditPurpose = (purpose: ListingPurpose) => {
    setEditingForm((current) => {
      if (!current) {
        return current;
      }

      const hasPurpose = current.purposes.includes(purpose);

      return {
        ...current,
        purposes: hasPurpose
          ? current.purposes.filter((value) => value !== purpose)
          : [...current.purposes, purpose],
      };
    });
  };

  const handleSaveListingEdit = async () => {
    if (!editingForm) {
      return;
    }

    const title = editingForm.title.trim().replace(/\s+/g, ' ');
    const description = editingForm.description.trim();
    const selectedPurposes = Array.from(new Set(editingForm.purposes));
    const isSellSelected = selectedPurposes.includes('sell');
    const isRentSelected = selectedPurposes.includes('rent');
    const sellPrice = editingForm.sellPrice.trim();
    const rentPrices: Record<RentDuration, string> = {
      hourly: editingForm.rentPrices.hourly.trim(),
      daily: editingForm.rentPrices.daily.trim(),
      weekly: editingForm.rentPrices.weekly.trim(),
      monthly: editingForm.rentPrices.monthly.trim(),
    };
    const locationCity = editingForm.locationCity.trim().replace(/\s+/g, ' ');
    const locationState = editingForm.locationState.trim().replace(/\s+/g, ' ');
    const locationLine1Input = editingForm.locationLine1
      .trim()
      .replace(/\s+/g, ' ');
    const locationLine1 =
      locationLine1Input ||
      [locationCity, locationState].filter((value) => value.length > 0).join(', ');
    const locationPincode = editingForm.locationPincode.trim();

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

    if (selectedPurposes.length === 0) {
      toast({
        title: 'Listing purpose is required',
        description: 'Select rent, sell, or both before saving.',
        variant: 'destructive',
      });
      return;
    }

    if (isSellSelected) {
      const parsedSellPrice = Number.parseFloat(sellPrice);
      if (
        sellPrice.length === 0 ||
        !Number.isFinite(parsedSellPrice) ||
        parsedSellPrice < 0
      ) {
        toast({
          title: 'Invalid sell price',
          description: 'Sell price must be a valid non-negative number.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (isRentSelected) {
      const hasAtLeastOneRentPrice = EDIT_RENT_DURATION_OPTIONS.some(
        (option) => rentPrices[option.value].length > 0
      );

      if (!hasAtLeastOneRentPrice) {
        toast({
          title: 'Rent price required',
          description: 'Add at least one rent duration price.',
          variant: 'destructive',
        });
        return;
      }

      for (const option of EDIT_RENT_DURATION_OPTIONS) {
        const priceValue = rentPrices[option.value];
        if (!priceValue) {
          continue;
        }

        const parsedValue = Number.parseFloat(priceValue);
        if (!Number.isFinite(parsedValue) || parsedValue < 0) {
          toast({
            title: `Invalid ${option.label.toLowerCase()} rent`,
            description: `${option.label} rent must be a valid non-negative number.`,
            variant: 'destructive',
          });
          return;
        }
      }
    }

    if (locationLine1.length < 2) {
      toast({
        title: 'Address line is required',
        description: 'Address line must be at least 2 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (locationCity.length < 2) {
      toast({
        title: 'City is required',
        description: 'City must be at least 2 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (locationState.length < 2) {
      toast({
        title: 'State is required',
        description: 'State must be at least 2 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (
      locationPincode.length > 0 &&
      !LOCATION_PINCODE_PATTERN.test(locationPincode)
    ) {
      toast({
        title: 'Invalid pincode',
        description: 'Pincode must be a 6-digit number.',
        variant: 'destructive',
      });
      return;
    }

    setSavingEditId(editingForm.productId);

    try {
      const requestBody: {
        title: string;
        description: string;
        purposes: ListingPurpose[];
        location: {
          line1: string;
          city: string;
          state: string;
          pincode: string;
          country: string;
        };
        featured: boolean;
        sellPrice: string | null;
        rentPrices: Partial<Record<RentDuration, string>>;
      } = {
        title,
        description,
        purposes: selectedPurposes,
        location: {
          line1: locationLine1,
          city: locationCity,
          state: locationState,
          pincode: locationPincode,
          country: 'IN',
        },
        featured: editingForm.featured,
        sellPrice: isSellSelected ? sellPrice : null,
        rentPrices: isRentSelected ? rentPrices : {},
      };

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
              type: 'sell' | 'rent' | 'both';
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
            type: payload.listing.type,
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
      router.refresh();
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

  const listingEditStepIndex = LISTING_EDIT_STEPS.findIndex(
    (step) => step.key === listingEditStep
  );
  const canGoToNextListingEditStep = (() => {
    if (!editingForm) {
      return false;
    }

    if (listingEditStep === 'details') {
      return (
        editingForm.title.trim().replace(/\s+/g, ' ').length >= 3 &&
        editingForm.description.trim().length >= 10
      );
    }

    if (listingEditStep === 'purpose') {
      return editingForm.purposes.length > 0;
    }

    if (listingEditStep === 'pricing') {
      const selectedPurposes = Array.from(new Set(editingForm.purposes));
      const isSellSelected = selectedPurposes.includes('sell');
      const isRentSelected = selectedPurposes.includes('rent');

      if (isSellSelected) {
        const sellPrice = editingForm.sellPrice.trim();
        const parsedSellPrice = Number.parseFloat(sellPrice);
        if (
          sellPrice.length === 0 ||
          !Number.isFinite(parsedSellPrice) ||
          parsedSellPrice < 0
        ) {
          return false;
        }
      }

      if (isRentSelected) {
        const rentValues = EDIT_RENT_DURATION_OPTIONS.map((option) =>
          editingForm.rentPrices[option.value].trim()
        );
        const hasAnyRentValue = rentValues.some((value) => value.length > 0);
        if (!hasAnyRentValue) {
          return false;
        }

        for (const rawValue of rentValues) {
          if (!rawValue) {
            continue;
          }

          const parsedValue = Number.parseFloat(rawValue);
          if (!Number.isFinite(parsedValue) || parsedValue < 0) {
            return false;
          }
        }
      }

      return true;
    }

    if (listingEditStep === 'location') {
      const locationLine1 = editingForm.locationLine1.trim().replace(/\s+/g, ' ');
      const locationCity = editingForm.locationCity.trim().replace(/\s+/g, ' ');
      const locationState = editingForm.locationState.trim().replace(/\s+/g, ' ');
      const locationPincode = editingForm.locationPincode.trim();

      return (
        locationLine1.length >= 2 &&
        locationCity.length >= 2 &&
        locationState.length >= 2 &&
        (locationPincode.length === 0 || LOCATION_PINCODE_PATTERN.test(locationPincode))
      );
    }

    return true;
  })();

  const goToNextListingEditStep = () => {
    if (!canGoToNextListingEditStep) {
      return;
    }

    const nextStep = LISTING_EDIT_STEPS[listingEditStepIndex + 1];
    if (nextStep) {
      setListingEditStep(nextStep.key);
    }
  };

  const goToPreviousListingEditStep = () => {
    const previousStep = LISTING_EDIT_STEPS[listingEditStepIndex - 1];
    if (previousStep) {
      setListingEditStep(previousStep.key);
    }
  };

  const canNavigateToListingEditStep = (targetStep: ListingEditStep) => {
    return Boolean(editingForm && targetStep);
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
              onClick={() => router.push(getProductHref(product))}
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
              listingFilter="all"
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

            <Link href="/" className="flex items-center gap-1">
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
                    alt={profileDisplayName}
                    fill
                    sizes="112px"
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
                  <h1 className="text-[2.02rem] font-semibold leading-tight tracking-tight text-foreground">{profileDisplayName}</h1>

                  <div
                    className={cn(
                      'mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
                      isVerified ? 'bg-primary/10' : 'bg-amber-100/80'
                    )}
                  >
                    <CheckCircle2 className={cn('h-4 w-4', isVerified ? 'text-primary' : 'text-amber-700')} />
                    <span className={cn('text-sm font-medium', isVerified ? 'text-primary' : 'text-amber-700')}>
                      {isVerified ? 'Verified Seller' : 'Not Verified'}
                    </span>
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
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit listing info</DialogTitle>
            <DialogDescription>
              Use the 5-step flow to edit any listing information, even after publishing.
            </DialogDescription>
          </DialogHeader>

          {editingForm && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {LISTING_EDIT_STEPS.map((flowStep, index) => {
                  const isActive = listingEditStep === flowStep.key;
                  const canOpen = canNavigateToListingEditStep(flowStep.key);

                  return (
                    <button
                      key={flowStep.key}
                      type="button"
                      onClick={() => {
                        if (canOpen) {
                          setListingEditStep(flowStep.key);
                        }
                      }}
                      disabled={!canOpen || Boolean(savingEditId)}
                      className={cn(
                        'rounded-lg border px-2.5 py-2 text-left transition-colors',
                        isActive
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border/60 bg-card text-muted-foreground',
                        (!canOpen || Boolean(savingEditId)) && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide">Step {index + 1}</p>
                      <p className="text-xs font-medium">{flowStep.label}</p>
                    </button>
                  );
                })}
              </div>

              {listingEditStep === 'details' && (
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
                </div>
              )}

              {listingEditStep === 'purpose' && (
                <div className="space-y-2">
                  <Label>Listing purpose</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {EDIT_PURPOSE_OPTIONS.map((option) => {
                      const isSelected = editingForm.purposes.includes(option.value);

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleEditPurpose(option.value)}
                          disabled={Boolean(savingEditId)}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-left transition-colors',
                            isSelected
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border/60 bg-card hover:border-primary/40 hover:bg-accent/30',
                            Boolean(savingEditId) && 'cursor-not-allowed opacity-70'
                          )}
                        >
                          <p className="text-sm font-medium">{option.label}</p>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Select one or both options.</p>
                </div>
              )}

              {listingEditStep === 'pricing' && (
                <div className="space-y-4">
                  {editingForm.purposes.includes('sell') && (
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

                  {editingForm.purposes.includes('rent') && (
                    <div className="space-y-2">
                      <Label>Rent prices (INR)</Label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {EDIT_RENT_DURATION_OPTIONS.map((option) => (
                          <div key={option.value} className="space-y-1.5">
                            <Label htmlFor={`listing-rent-${option.value}`}>{option.label} rent</Label>
                            <Input
                              id={`listing-rent-${option.value}`}
                              inputMode="decimal"
                              value={editingForm.rentPrices[option.value]}
                              onChange={(event) =>
                                setEditingForm((current) =>
                                  current
                                    ? {
                                        ...current,
                                        rentPrices: {
                                          ...current.rentPrices,
                                          [option.value]: event.target.value,
                                        },
                                      }
                                    : current
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Add at least one rent duration price.</p>
                    </div>
                  )}

                  {!editingForm.purposes.includes('sell') &&
                    !editingForm.purposes.includes('rent') && (
                      <p className="rounded-lg border border-border/60 bg-accent/30 px-3 py-2 text-sm text-muted-foreground">
                        Select listing purpose first to edit pricing.
                      </p>
                    )}
                </div>
              )}

              {listingEditStep === 'location' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Address details</Label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="listing-address-line">Address line</Label>
                        <Input
                          id="listing-address-line"
                          value={editingForm.locationLine1}
                          onChange={(event) =>
                            setEditingForm((current) =>
                              current
                                ? {
                                    ...current,
                                    locationLine1: event.target.value,
                                  }
                                : current
                            )
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="listing-address-city">City</Label>
                        <Input
                          id="listing-address-city"
                          value={editingForm.locationCity}
                          onChange={(event) =>
                            setEditingForm((current) =>
                              current
                                ? {
                                    ...current,
                                    locationCity: event.target.value,
                                  }
                                : current
                            )
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="listing-address-state">State</Label>
                        <Input
                          id="listing-address-state"
                          value={editingForm.locationState}
                          onChange={(event) =>
                            setEditingForm((current) =>
                              current
                                ? {
                                    ...current,
                                    locationState: event.target.value,
                                  }
                                : current
                            )
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="listing-address-pincode">Pincode</Label>
                        <Input
                          id="listing-address-pincode"
                          inputMode="numeric"
                          value={editingForm.locationPincode}
                          onChange={(event) =>
                            setEditingForm((current) =>
                              current
                                ? {
                                    ...current,
                                    locationPincode: event.target.value.replace(/\D/g, '').slice(0, 6),
                                  }
                                : current
                            )
                          }
                        />
                      </div>
                    </div>
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
                </div>
              )}

              {listingEditStep === 'review' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Review your edits before saving</p>

                  <div className="rounded-lg border border-border/60 bg-accent/20 p-3 text-sm">
                    <p className="font-medium text-foreground">{editingForm.title || 'Untitled listing'}</p>
                    <p className="mt-1 text-muted-foreground">
                      {editingForm.description || 'No description'}
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      Purpose: {editingForm.purposes.length > 0 ? editingForm.purposes.join(' + ') : 'None'}
                    </p>
                    <p className="text-muted-foreground">
                      Location: {[editingForm.locationCity, editingForm.locationState]
                        .filter((value) => value.trim().length > 0)
                        .join(', ') || 'Not set'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setListingEditStep('details')}
                      disabled={Boolean(savingEditId)}
                    >
                      Edit basic info
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setListingEditStep('purpose')}
                      disabled={Boolean(savingEditId)}
                    >
                      Edit purpose
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setListingEditStep('pricing')}
                      disabled={Boolean(savingEditId)}
                    >
                      Edit pricing
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setListingEditStep('location')}
                      disabled={Boolean(savingEditId)}
                    >
                      Edit location
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (listingEditStep === 'details') {
                  setEditingForm(null);
                  return;
                }

                goToPreviousListingEditStep();
              }}
              disabled={Boolean(savingEditId)}
            >
              {listingEditStep === 'details' ? 'Cancel' : 'Back'}
            </Button>
            {listingEditStep === 'review' ? (
              <Button
                onClick={() => void handleSaveListingEdit()}
                disabled={Boolean(savingEditId)}
              >
                {savingEditId ? 'Saving...' : 'Save changes'}
              </Button>
            ) : (
              <Button
                onClick={goToNextListingEditStep}
                disabled={Boolean(savingEditId) || !canGoToNextListingEditStep}
              >
                Next
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(settingsDialog)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSettingsDialog(null);
          }
        }}
      >
        <DialogContent
          className={cn(
            'max-h-[85vh] overflow-y-auto sm:max-w-lg',
            settingsDialog === 'address' && 'sm:max-w-2xl'
          )}
        >
          {settingsDialog ? (
            <>
              <DialogHeader>
                <DialogTitle>{settingsDialogTitleMap[settingsDialog]}</DialogTitle>
                <DialogDescription>
                  {settingsDialogDescriptionMap[settingsDialog]}
                </DialogDescription>
              </DialogHeader>

              {settingsDialog === 'profile' ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-name">Display name</Label>
                    <Input
                      id="profile-name"
                      value={profileFormName}
                      onChange={(event) => setProfileFormName(event.target.value)}
                      disabled={isSavingProfile}
                      placeholder="Your name"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-email">Email</Label>
                    <Input id="profile-email" value={email} disabled readOnly />
                    <p className="text-xs text-muted-foreground">
                      Email changes are managed via authentication settings.
                    </p>
                  </div>
                </div>
              ) : null}

              {settingsDialog === 'address' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="address-line">Address line</Label>
                      <Input
                        id="address-line"
                        value={addressForm.address}
                        onChange={(event) =>
                          setAddressForm((current) => ({
                            ...current,
                            address: event.target.value,
                          }))
                        }
                        placeholder="House / street"
                        disabled={isSavingAddress}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="address-city">City</Label>
                      <Input
                        id="address-city"
                        value={addressForm.city}
                        onChange={(event) =>
                          setAddressForm((current) => ({
                            ...current,
                            city: event.target.value,
                          }))
                        }
                        placeholder="City"
                        disabled={isSavingAddress}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="address-state">State</Label>
                      <Input
                        id="address-state"
                        value={addressForm.state}
                        onChange={(event) =>
                          setAddressForm((current) => ({
                            ...current,
                            state: event.target.value,
                          }))
                        }
                        placeholder="State"
                        disabled={isSavingAddress}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="address-pincode">Pincode</Label>
                      <Input
                        id="address-pincode"
                        value={addressForm.pincode}
                        onChange={(event) =>
                          setAddressForm((current) => ({
                            ...current,
                            pincode: event.target.value.replace(/\D/g, '').slice(0, 6),
                          }))
                        }
                        placeholder="6-digit pincode"
                        inputMode="numeric"
                        disabled={isSavingAddress}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={resetAddressForm}
                      disabled={isSavingAddress}
                    >
                      Clear form
                    </Button>
                    <Button
                      onClick={() => void handleAddressSave()}
                      disabled={isSavingAddress}
                    >
                      {isSavingAddress
                        ? 'Saving...'
                        : addressForm.id
                          ? 'Update address'
                          : 'Add address'}
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border/60">
                    <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                      <p className="text-sm font-medium text-foreground">Saved addresses</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void loadAddresses()}
                        disabled={isLoadingAddresses}
                      >
                        {isLoadingAddresses ? 'Refreshing...' : 'Refresh'}
                      </Button>
                    </div>

                    <div className="max-h-60 overflow-y-auto divide-y divide-border/50">
                      {isLoadingAddresses ? (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                          Loading addresses...
                        </div>
                      ) : null}

                      {!isLoadingAddresses && addresses.length === 0 ? (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                          No addresses saved yet.
                        </div>
                      ) : null}

                      {!isLoadingAddresses
                        ? addresses.map((address) => {
                            const isDeleting = deletingAddressId === address.id;

                            return (
                              <div
                                key={address.id}
                                className="flex items-start justify-between gap-3 px-3 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground">
                                    {address.address}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {address.city}, {address.state} - {address.pincode}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleAddressEdit(address)}
                                    disabled={isDeleting}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => void handleAddressDelete(address.id)}
                                    disabled={isDeleting}
                                  >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {settingsDialog === 'payment' ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="payment-label">Method label</Label>
                    <Input
                      id="payment-label"
                      value={paymentMethodForm.label}
                      onChange={(event) =>
                        setPaymentMethodForm((current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                      placeholder="UPI, Bank Account, Wallet"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="payment-details">Method details</Label>
                    <Input
                      id="payment-details"
                      value={paymentMethodForm.details}
                      onChange={(event) =>
                        setPaymentMethodForm((current) => ({
                          ...current,
                          details: event.target.value,
                        }))
                      }
                      placeholder="Example: renthour@upi"
                    />
                    <p className="text-xs text-muted-foreground">
                      Stored locally in this browser only.
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-accent/25 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Make default</p>
                      <p className="text-xs text-muted-foreground">
                        Use this method as your primary payment option.
                      </p>
                    </div>
                    <Switch
                      checked={paymentMethodForm.makeDefault}
                      onCheckedChange={(checked) =>
                        setPaymentMethodForm((current) => ({
                          ...current,
                          makeDefault: checked,
                        }))
                      }
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button onClick={handleAddPaymentMethod}>Add method</Button>
                    <Button
                      variant="outline"
                      onClick={() => setPaymentMethodForm(EMPTY_PAYMENT_FORM)}
                    >
                      Clear
                    </Button>
                  </div>

                  <div className="space-y-2 rounded-lg border border-border/60 p-3">
                    <p className="text-sm font-medium text-foreground">Saved methods</p>

                    {paymentMethods.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No payment methods added yet.
                      </p>
                    ) : null}

                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-border/50 p-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {method.label}
                            {method.isDefault ? (
                              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                                Default
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {method.details}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!method.isDefault ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSetDefaultPaymentMethod(method.id)}
                            >
                              Set default
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemovePaymentMethod(method.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {settingsDialog === 'notifications' ? (
                <div className="space-y-3">
                  {[
                    {
                      key: 'bookingUpdates' as const,
                      label: 'Booking updates',
                      description: 'Get notified about booking requests and status changes.',
                    },
                    {
                      key: 'listingPerformance' as const,
                      label: 'Listing performance',
                      description: 'Receive updates on views, saves, and listing activity.',
                    },
                    {
                      key: 'securityAlerts' as const,
                      label: 'Security alerts',
                      description: 'Important account and password notifications.',
                    },
                    {
                      key: 'marketingEmails' as const,
                      label: 'Marketing emails',
                      description: 'Product updates, campaigns, and marketplace news.',
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <Switch
                        checked={notificationPreferences[item.key]}
                        onCheckedChange={(checked) =>
                          handleNotificationToggle(item.key, checked)
                        }
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {settingsDialog === 'security' ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="security-current">Current password</Label>
                    <Input
                      id="security-current"
                      type="password"
                      value={securityForm.currentPassword}
                      onChange={(event) =>
                        setSecurityForm((current) => ({
                          ...current,
                          currentPassword: event.target.value,
                        }))
                      }
                      placeholder="Enter current password"
                      disabled={isUpdatingPassword}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="security-new">New password</Label>
                    <Input
                      id="security-new"
                      type="password"
                      value={securityForm.newPassword}
                      onChange={(event) =>
                        setSecurityForm((current) => ({
                          ...current,
                          newPassword: event.target.value,
                        }))
                      }
                      placeholder="At least 8 characters"
                      disabled={isUpdatingPassword}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="security-confirm">Confirm new password</Label>
                    <Input
                      id="security-confirm"
                      type="password"
                      value={securityForm.confirmPassword}
                      onChange={(event) =>
                        setSecurityForm((current) => ({
                          ...current,
                          confirmPassword: event.target.value,
                        }))
                      }
                      placeholder="Repeat new password"
                      disabled={isUpdatingPassword}
                    />
                  </div>
                </div>
              ) : null}

              {settingsDialog === 'support' ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Need help with listings, bookings, or account issues? Use one of these support channels.
                  </p>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button variant="outline" onClick={() => router.push('/messages')}>
                      Open Messages
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="mailto:support@renthour.in">Email Support</a>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/privacy-policy" target="_blank">
                        Privacy Policy
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/terms-of-use" target="_blank">
                        Terms Of Use
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : null}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSettingsDialog(null)}
                  disabled={isSavingProfile || isSavingAddress || isUpdatingPassword}
                >
                  Close
                </Button>

                {settingsDialog === 'profile' ? (
                  <Button
                    onClick={() => void handleSaveProfile()}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? 'Saving...' : 'Save profile'}
                  </Button>
                ) : null}

                {settingsDialog === 'security' ? (
                  <Button
                    onClick={() => void handleUpdatePassword()}
                    disabled={isUpdatingPassword}
                  >
                    {isUpdatingPassword ? 'Updating...' : 'Update password'}
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <PostListingFlowDialog open={postFlowOpen} onOpenChange={setPostFlowOpen} />
    </main>
  );
}
