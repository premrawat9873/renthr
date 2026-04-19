export interface RentPrices {
  hourly: number | null;
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
}

export interface Product {
  id: string;
  title: string;
  type: "sell" | "rent" | "both";
  price: number | null;
  rentPrices: RentPrices | null;
  category: string;
  image: string;
  images: string[];
  videoUrl?: string;
  videoDurationSeconds?: number;
  videoSizeBytes?: number;
  videoContentType?: string;
  location: string;
  locationLatitude?: number;
  locationLongitude?: number;
  distance: number;
  isAvailable: boolean;
  postedAt: Date;
  rating?: number;
  reviewCount?: number;
  featured?: boolean;
  description?: string;
  features?: string[];
  ownerId?: string;
  ownerName?: string;
  ownerImage?: string;
  ownerTag?: string;
  ownerIsVerified?: boolean;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
}

export type ListingFilter = "all" | "rent" | "sell";
export type RentDuration = "hourly" | "daily" | "weekly" | "monthly";
export type SortOption = "newest" | "price-asc" | "price-desc" | "distance";

export function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatPrice(price: number): string {
  return `₹${price.toLocaleString("en-IN")}`;
}
