import "server-only";

import type {
  ListingFilter,
  Product,
  RentDuration,
  SortOption,
} from "@/data/marketplaceData";
import {
  serializeListingProduct,
  type ListingProductPayload,
} from "@/data/listings";
import type { Prisma } from "../../generated/prisma/client";
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar";
import { prisma } from "@/lib/prisma";

export const MARKETPLACE_DEFAULT_PAGE_SIZE = 8;
export const MARKETPLACE_MAX_PAGE_SIZE = 30;

const DEFAULT_IMAGE_URL =
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&h=900&fit=crop";

const VALID_LISTING_FILTERS: ListingFilter[] = ["all", "rent", "sell"];
const VALID_SORT_OPTIONS: SortOption[] = [
  "newest",
  "price-asc",
  "price-desc",
  "distance",
];
const VALID_RENT_DURATIONS: RentDuration[] = [
  "hourly",
  "daily",
  "weekly",
  "monthly",
];
const CATEGORY_FILTER_ALIASES: Record<string, string> = {
  "home-appliances": "appliances",
  "baby-kids": "baby",
  kids: "baby",
};

const listingSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  category: {
    select: {
      name: true,
      slug: true,
    },
  },
  address: {
    select: {
      city: true,
      state: true,
      latitude: true,
      longitude: true,
    },
  },
  listingType: true,
  sellPricePaise: true,
  rentHourlyPaise: true,
  rentDailyPaise: true,
  rentWeeklyPaise: true,
  rentMonthlyPaise: true,
  images: {
    select: {
      url: true,
      sortOrder: true,
      isPrimary: true,
    },
  },
  reviews: {
    select: {
      rating: true,
    },
  },
  featured: true,
  videoUrl: true,
  videoDurationSeconds: true,
  videoSizeBytes: true,
  videoMimeType: true,
  createdAt: true,
  author: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      phone: true,
      isVerified: true,
    },
  },
} satisfies Prisma.PostSelect;

type ListingRecord = Prisma.PostGetPayload<{ select: typeof listingSelect }>;

type MarketplaceListingsPageOptions = {
  limit?: number;
  cursor?: number | string | null;
  searchQuery?: string | null;
  category?: string | null;
  categories?: string[] | null;
  filter?: ListingFilter;
  rentDurations?: RentDuration[];
  sort?: SortOption;
  minPrice?: number | null;
  maxPrice?: number | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ListingsByUserOptions = {
  includeInactive?: boolean;
};

export type PublicListingUserProfile = {
  id: string;
  name: string;
  avatarUrl: string;
  rating: number;
  reviewCount: number;
  joinedAt: Date;
  isVerified: boolean;
};

export type PublicUserReviewHighlight = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  reviewer: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  post: {
    id: string;
    title: string;
    category: string;
    location: string;
  };
};

type PublicUserReviewHighlightsOptions = {
  limit?: number;
};

export type MarketplaceListingProductsPayloadPage = {
  products: ListingProductPayload[];
  nextCursor: string | null;
  hasMore: boolean;
};

function isDatabaseNotReachableError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    code?: unknown;
    message?: unknown;
    name?: unknown;
  };

  const code =
    typeof maybeError.code === "string"
      ? maybeError.code
      : "";
  const message =
    typeof maybeError.message === "string"
      ? maybeError.message
      : "";
  const name =
    typeof maybeError.name === "string"
      ? maybeError.name
      : "";

  const normalizedCode = code.toUpperCase();
  const normalizedMessage = message.toLowerCase();
  const normalizedName = name.toLowerCase();

  return (
    normalizedCode === "P1001" ||
    normalizedCode === "EAI_AGAIN" ||
    normalizedCode === "ENOTFOUND" ||
    normalizedCode === "ECONNREFUSED" ||
    normalizedCode === "ECONNRESET" ||
    normalizedCode === "ETIMEDOUT" ||
    normalizedCode === "EHOSTUNREACH" ||
    normalizedCode === "ENETUNREACH" ||
    normalizedMessage.includes("can't reach database server") ||
    normalizedMessage.includes("database is unreachable") ||
    normalizedMessage.includes("databasenotreachable") ||
    normalizedMessage.includes("getaddrinfo eai_again") ||
    normalizedMessage.includes("getaddrinfo enotfound") ||
    normalizedMessage.includes("connect etimedout") ||
    normalizedMessage.includes("connection timed out") ||
    normalizedName.includes("databasenotreachable")
  );
}

async function withDatabaseReadFallback<T>(
  label: string,
  query: () => Promise<T>,
  fallback: T
) {
  try {
    return await query();
  } catch (error) {
    if (isDatabaseNotReachableError(error)) {
      console.error(
        `[listings] ${label} failed because database is unreachable. Returning fallback.`
      );
      return fallback;
    }

    throw error;
  }
}

function normalizePageSize(limit?: number) {
  if (!Number.isFinite(limit)) {
    return MARKETPLACE_DEFAULT_PAGE_SIZE;
  }

  const normalized = Math.floor(limit as number);
  if (normalized <= 0) {
    return MARKETPLACE_DEFAULT_PAGE_SIZE;
  }

  return Math.min(normalized, MARKETPLACE_MAX_PAGE_SIZE);
}

function parseListingCursor(cursor: number | string | null | undefined) {
  if (cursor == null) {
    return null;
  }

  const parsed =
    typeof cursor === "number" ? cursor : Number.parseInt(String(cursor), 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
}

function normalizeListingFilter(value: unknown): ListingFilter {
  return VALID_LISTING_FILTERS.includes(value as ListingFilter)
    ? (value as ListingFilter)
    : "all";
}

function normalizeSortOption(value: unknown): SortOption {
  return VALID_SORT_OPTIONS.includes(value as SortOption)
    ? (value as SortOption)
    : "newest";
}

function normalizeRentDurations(value: unknown): RentDuration[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((duration): duration is RentDuration =>
      VALID_RENT_DURATIONS.includes(duration as RentDuration)
    )
    .map((duration) => duration);

  return Array.from(new Set(normalized));
}

function normalizeSearchQuery(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeLocationFilterQuery(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizePriceValue(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.floor(value as number));
}

function convertPaiseToAmount(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value / 100;
}

function convertDecimalToNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === "object") {
    const candidate = value as {
      toNumber?: () => number;
      toString?: () => string;
    };

    if (typeof candidate.toNumber === "function") {
      const parsed = candidate.toNumber();
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    if (typeof candidate.toString === "function") {
      const parsed = Number.parseFloat(candidate.toString());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function formatListingLocation(address: ListingRecord["address"]) {
  if (!address) {
    return "Location not specified";
  }

  const parts = [address.city, address.state]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return parts.length > 0 ? parts.join(", ") : "Location not specified";
}

function normalizeAddressCoordinate(value: unknown) {
  const parsed = convertDecimalToNumber(value);
  return parsed != null && Number.isFinite(parsed) ? Number(parsed.toFixed(7)) : undefined;
}

function normalizeCategorySlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCategoryFilterKey(value: string | null | undefined) {
  const normalized = normalizeCategorySlug(value ?? "");
  if (!normalized) {
    return "";
  }

  return CATEGORY_FILTER_ALIASES[normalized] ?? normalized;
}

function normalizeCategoryFilterKeys(values: Array<string | null | undefined>) {
  const normalized = values
    .map((value) => normalizeCategoryFilterKey(value))
    .filter((value) => value.length > 0);

  return Array.from(new Set(normalized));
}

function resolveCategoryId(category: ListingRecord["category"]) {
  const slug = category?.slug?.trim();
  if (slug) {
    return normalizeCategorySlug(slug);
  }

  const name = category?.name?.trim();
  if (name) {
    return normalizeCategorySlug(name) || "uncategorized";
  }

  return "uncategorized";
}

function normalizeImageList(input: ListingRecord["images"]) {
  const ordered = [...input]
    .sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) {
        return Number(right.isPrimary) - Number(left.isPrimary);
      }

      return left.sortOrder - right.sortOrder;
    })
    .map((value) => value.url.trim())
    .filter((value) => value.length > 0);

  const unique = Array.from(new Set(ordered));
  const primaryImage = unique[0] ?? DEFAULT_IMAGE_URL;

  return {
    primaryImage,
    images: unique.length > 0 ? unique : [primaryImage],
  };
}

function mapListingRecordToProduct(record: ListingRecord): Product {
  const supportsRent =
    record.listingType === "RENT" || record.listingType === "BOTH";
  const supportsSell =
    record.listingType === "SELL" || record.listingType === "BOTH";
  const listingType: Product["type"] =
    supportsRent && supportsSell ? "both" : supportsRent ? "rent" : "sell";
  const normalizedImages = normalizeImageList(record.images);
  const ownerName =
    record.author.name?.trim() ||
    record.author.email.split("@")[0] ||
    "User";
  const categoryId = resolveCategoryId(record.category);
  const reviewRatings = record.reviews
    .map((review) => convertDecimalToNumber(review.rating))
    .filter((rating): rating is number => typeof rating === "number");
  const reviewCount = reviewRatings.length;
  const ownerIsVerified = Boolean(record.author.isVerified && record.author.phone);
  const rating =
    reviewCount > 0
      ? Number(
          (
            reviewRatings.reduce((sum, value) => sum + value, 0) / reviewCount
          ).toFixed(1)
        )
      : null;

  return {
    id: String(record.id),
    title: record.title,
    type: listingType,
    price: supportsSell ? convertPaiseToAmount(record.sellPricePaise) : null,
    rentPrices:
      supportsRent
        ? {
            hourly: convertPaiseToAmount(record.rentHourlyPaise),
            daily: convertPaiseToAmount(record.rentDailyPaise),
            weekly: convertPaiseToAmount(record.rentWeeklyPaise),
            monthly: convertPaiseToAmount(record.rentMonthlyPaise),
          }
        : null,
    category: categoryId,
    image: normalizedImages.primaryImage,
    images: normalizedImages.images,
    location: formatListingLocation(record.address),
    locationLatitude: normalizeAddressCoordinate(record.address?.latitude),
    locationLongitude: normalizeAddressCoordinate(record.address?.longitude),
    distance: -1,
    isAvailable: record.status === "ACTIVE",
    postedAt: record.createdAt,
    ...(rating != null ? { rating } : {}),
    featured: record.featured,
    ...(reviewCount > 0 ? { reviewCount } : {}),
    description: record.description ?? undefined,
    videoUrl: record.videoUrl ?? undefined,
    videoDurationSeconds: record.videoDurationSeconds ?? undefined,
    videoSizeBytes: record.videoSizeBytes ?? undefined,
    videoContentType: record.videoMimeType ?? undefined,
    ownerId: String(record.author.id),
    ownerName,
    ownerImage: resolveProfileAvatarUrl(record.author.avatarUrl),
    ownerTag: ownerIsVerified ? "Verified Seller" : "Not Verified",
    ownerIsVerified,
  };
}

function supportsRent(product: Product) {
  return product.type === "rent" || product.type === "both";
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
  if (filter === "sell") {
    return product.price;
  }

  if (filter === "rent") {
    return getPrimaryRentPrice(product);
  }

  if (product.type === "sell") {
    return product.price;
  }

  if (product.type === "rent") {
    return getPrimaryRentPrice(product);
  }

  const candidates = [product.price, getPrimaryRentPrice(product)].filter(
    (value): value is number => value != null
  );

  return candidates.length > 0 ? Math.min(...candidates) : null;
}

function compareProductIds(left: Product, right: Product) {
  return left.id.localeCompare(right.id, undefined, { numeric: true });
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
  to: { latitude: number; longitude: number }
) {
  const earthRadiusKm = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function normalizeUserCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const normalizedLatitude = latitude as number;
  const normalizedLongitude = longitude as number;

  if (
    normalizedLatitude < -90 ||
    normalizedLatitude > 90 ||
    normalizedLongitude < -180 ||
    normalizedLongitude > 180
  ) {
    return null;
  }

  return {
    latitude: normalizedLatitude,
    longitude: normalizedLongitude,
  };
}

function applyDistanceToProducts(
  products: Product[],
  userCoordinates: { latitude: number; longitude: number } | null
) {
  if (!userCoordinates) {
    return products.map((product) => ({ ...product, distance: -1 }));
  }

  return products.map((product) => {
    if (
      !Number.isFinite(product.locationLatitude) ||
      !Number.isFinite(product.locationLongitude)
    ) {
      return {
        ...product,
        distance: -1,
      };
    }

    const computedDistance = haversineDistanceKm(userCoordinates, {
      latitude: product.locationLatitude as number,
      longitude: product.locationLongitude as number,
    });

    return {
      ...product,
      distance: Number(computedDistance.toFixed(1)),
    };
  });
}

function applyRentDurationFilter(
  products: Product[],
  filter: ListingFilter,
  rentDurations: RentDuration[]
) {
  if (filter !== "rent" || rentDurations.length === 0) {
    return products;
  }

  return products.filter((product) => {
    if (!supportsRent(product) || !product.rentPrices) {
      return false;
    }

    return rentDurations.some((duration) => product.rentPrices?.[duration] != null);
  });
}

function applyPriceRangeFilter(
  products: Product[],
  filter: ListingFilter,
  minPrice: number | null,
  maxPrice: number | null
) {
  if (minPrice == null && maxPrice == null) {
    return products;
  }

  const floor = minPrice ?? 0;
  const ceiling = maxPrice ?? Number.POSITIVE_INFINITY;

  return products.filter((product) => {
    const comparablePrice = getComparablePrice(product, filter);
    if (comparablePrice == null) {
      return false;
    }

    return comparablePrice >= floor && comparablePrice <= ceiling;
  });
}

function sortMarketplaceProducts(
  products: Product[],
  sort: SortOption,
  filter: ListingFilter,
  hasUserCoordinates: boolean
) {
  const sorted = [...products];

  if (sort === "price-asc") {
    sorted.sort((left, right) => {
      const leftPrice = getComparablePrice(left, filter) ?? Number.POSITIVE_INFINITY;
      const rightPrice = getComparablePrice(right, filter) ?? Number.POSITIVE_INFINITY;
      const byPrice = leftPrice - rightPrice;
      return byPrice !== 0 ? byPrice : compareProductIds(left, right);
    });
    return sorted;
  }

  if (sort === "price-desc") {
    sorted.sort((left, right) => {
      const leftPrice = getComparablePrice(left, filter) ?? 0;
      const rightPrice = getComparablePrice(right, filter) ?? 0;
      const byPrice = rightPrice - leftPrice;
      return byPrice !== 0 ? byPrice : compareProductIds(left, right);
    });
    return sorted;
  }

  if (sort === "distance" && hasUserCoordinates) {
    sorted.sort((left, right) => {
      const leftDistance = normalizeDistanceForSorting(left.distance);
      const rightDistance = normalizeDistanceForSorting(right.distance);
      if (leftDistance === rightDistance) {
        return compareProductIds(left, right);
      }

      const byDistance = leftDistance - rightDistance;
      return byDistance !== 0 ? byDistance : compareProductIds(left, right);
    });
    return sorted;
  }

  sorted.sort((left, right) => {
    const byTime = right.postedAt.getTime() - left.postedAt.getTime();
    return byTime !== 0 ? byTime : compareProductIds(left, right);
  });
  return sorted;
}

function buildMarketplaceListingsWhere(
  options: MarketplaceListingsPageOptions
): Prisma.PostWhereInput {
  const filter = normalizeListingFilter(options.filter);
  const normalizedCategories = normalizeCategoryFilterKeys([
    ...(Array.isArray(options.categories) ? options.categories : []),
    options.category,
  ]);
  const normalizedSearchQuery = normalizeSearchQuery(options.searchQuery);
  const normalizedLocationQuery = normalizeLocationFilterQuery(options.location);

  const where: Prisma.PostWhereInput = {
    status: "ACTIVE",
    publishedAt: {
      not: null,
    },
  };

  if (filter === "rent") {
    where.listingType = {
      in: ["RENT", "BOTH"],
    };
  }

  if (filter === "sell") {
    where.listingType = {
      in: ["SELL", "BOTH"],
    };
  }

  if (normalizedCategories.length > 0) {
    where.category = {
      is: {
        slug: {
          in: normalizedCategories,
        },
      },
    };
  }

  if (normalizedSearchQuery) {
    const normalizedSearchSlug = normalizeCategorySlug(normalizedSearchQuery);
    const searchConditions: Prisma.PostWhereInput[] = [
      {
        title: {
          contains: normalizedSearchQuery,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: normalizedSearchQuery,
          mode: "insensitive",
        },
      },
      {
        category: {
          is: {
            name: {
              contains: normalizedSearchQuery,
              mode: "insensitive",
            },
          },
        },
      },
      {
        address: {
          is: {
            city: {
              contains: normalizedSearchQuery,
              mode: "insensitive",
            },
          },
        },
      },
      {
        address: {
          is: {
            state: {
              contains: normalizedSearchQuery,
              mode: "insensitive",
            },
          },
        },
      },
    ];

    if (normalizedSearchSlug) {
      searchConditions.push({
        category: {
          is: {
            slug: {
              contains: normalizedSearchSlug,
              mode: "insensitive",
            },
          },
        },
      });
    }

    where.OR = searchConditions;
  }

  if (normalizedLocationQuery) {
    where.AND = [
      {
        OR: [
          {
            address: {
              is: {
                city: {
                  contains: normalizedLocationQuery,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            address: {
              is: {
                state: {
                  contains: normalizedLocationQuery,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            address: {
              is: {
                line1: {
                  contains: normalizedLocationQuery,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      },
    ];
  }

  return where;
}

async function findManyListings() {
  return prisma.post.findMany({
    where: {
      status: "ACTIVE",
      publishedAt: {
        not: null,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: listingSelect,
  });
}

async function findManyListingsForMarketplaceQuery(
  where: Prisma.PostWhereInput
) {
  return prisma.post.findMany({
    where,
    orderBy: {
      id: "desc",
    },
    select: listingSelect,
  });
}

async function findManyListingsByAuthorId(
  authorId: number,
  options: ListingsByUserOptions = {}
) {
  const includeInactive = options.includeInactive ?? false;

  return prisma.post.findMany({
    where: {
      authorId,
      status: includeInactive
        ? {
            in: ["ACTIVE", "INACTIVE"],
          }
        : "ACTIVE",
      publishedAt: {
        not: null,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: listingSelect,
  });
}

async function findWishlistListingsByUserId(userId: number) {
  return prisma.wishlistItem.findMany({
    where: {
      userId,
      post: {
        publishedAt: {
          not: null,
        },
        status: {
          in: ["ACTIVE", "INACTIVE"],
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      post: {
        select: listingSelect,
      },
    },
  });
}

function parseListingId(id: string) {
  const parsed = Number.parseInt(id, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function formatUserDisplayName(name: string | null, email: string) {
  const normalizedName = name?.trim();
  if (normalizedName) {
    return normalizedName;
  }

  const emailPrefix = email.split("@")[0]?.trim();
  return emailPrefix || "User";
}

function normalizeReviewHighlightsLimit(limit?: number) {
  if (!Number.isFinite(limit)) {
    return 6;
  }

  const parsedLimit = Math.floor(limit as number);
  if (parsedLimit <= 0) {
    return 6;
  }

  return Math.min(parsedLimit, 20);
}

function formatReviewPostLocation(address: { city: string; state: string } | null) {
  if (!address) {
    return "Location not specified";
  }

  const parts = [address.city, address.state]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return parts.length > 0 ? parts.join(", ") : "Location not specified";
}

function formatReviewPostCategory(category: {
  name: string;
  slug: string;
} | null) {
  const slug = category?.slug?.trim();
  if (slug) {
    return normalizeCategorySlug(slug);
  }

  const name = category?.name?.trim();
  if (name) {
    return normalizeCategorySlug(name) || "listing";
  }

  return "listing";
}

export async function getMarketplaceListingProducts() {
  const records = await withDatabaseReadFallback(
    "getMarketplaceListingProducts",
    () => findManyListings(),
    [] as ListingRecord[]
  );
  return records.map(mapListingRecordToProduct);
}

export async function getMarketplaceListingProductsPayload() {
  const products = await getMarketplaceListingProducts();
  return products.map(serializeListingProduct);
}

export async function getMarketplaceListingProductsPayloadPage(
  options: MarketplaceListingsPageOptions = {}
): Promise<MarketplaceListingProductsPayloadPage> {
  const limit = normalizePageSize(options.limit);
  const cursorOffset = parseListingCursor(options.cursor) ?? 0;
  const filter = normalizeListingFilter(options.filter);
  const sort = normalizeSortOption(options.sort);
  const rentDurations = normalizeRentDurations(options.rentDurations ?? []);
  const minPrice = normalizePriceValue(options.minPrice);
  const maxPrice = normalizePriceValue(options.maxPrice);
  const userCoordinates = normalizeUserCoordinates(
    options.latitude,
    options.longitude
  );

  const where = buildMarketplaceListingsWhere(options);
  const records = await withDatabaseReadFallback(
    "getMarketplaceListingProductsPayloadPage",
    () => findManyListingsForMarketplaceQuery(where),
    [] as ListingRecord[]
  );

  const products = records.map(mapListingRecordToProduct);
  const withDistances = applyDistanceToProducts(products, userCoordinates);
  const withRentDurationFilter = applyRentDurationFilter(
    withDistances,
    filter,
    rentDurations
  );
  const withPriceRangeFilter = applyPriceRangeFilter(
    withRentDurationFilter,
    filter,
    minPrice,
    maxPrice
  );
  const sortedProducts = sortMarketplaceProducts(
    withPriceRangeFilter,
    sort,
    filter,
    Boolean(userCoordinates)
  );

  const visibleProducts = sortedProducts.slice(cursorOffset, cursorOffset + limit);
  const nextOffset = cursorOffset + visibleProducts.length;
  const hasMore = nextOffset < sortedProducts.length;
  const nextCursor = hasMore ? String(nextOffset) : null;

  const payload = visibleProducts.map((product) => serializeListingProduct(product));

  return {
    products: payload,
    nextCursor,
    hasMore,
  };
}

export async function getMarketplaceListingProductsByUserId(
  userId: number | string,
  options: ListingsByUserOptions = {}
) {
  const parsedUserId =
    typeof userId === "number" ? userId : Number.parseInt(userId, 10);
  if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
    return [];
  }

  const includeInactive = options.includeInactive ?? false;

  const records = await withDatabaseReadFallback(
    "getMarketplaceListingProductsByUserId",
    () => findManyListingsByAuthorId(parsedUserId, { includeInactive }),
    [] as ListingRecord[]
  );
  return records.map(mapListingRecordToProduct);
}

export async function getWishlistProductsByUserId(userId: number | string) {
  const parsedUserId =
    typeof userId === "number" ? userId : Number.parseInt(userId, 10);
  if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
    return [];
  }

  const records = await withDatabaseReadFallback(
    "getWishlistProductsByUserId",
    () => findWishlistListingsByUserId(parsedUserId),
    [] as Array<{ post: ListingRecord | null }>
  );

  return records
    .map((item) => item.post)
    .filter((post): post is ListingRecord => Boolean(post))
    .map(mapListingRecordToProduct);
}

export async function getMarketplaceListingProductsPayloadByUserId(
  userId: number | string
) {
  const products = await getMarketplaceListingProductsByUserId(userId);
  return products.map(serializeListingProduct);
}

export async function getWishlistProductPayloadByUserId(
  userId: number | string
) {
  const products = await getWishlistProductsByUserId(userId);
  return products.map(serializeListingProduct);
}

export async function getPublicListingUserProfileById(userId: string | number) {
  const parsedUserId =
    typeof userId === "number" ? userId : Number.parseInt(userId, 10);
  if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
    return null;
  }

  const user = await withDatabaseReadFallback(
    "getPublicListingUserProfileById",
    () =>
      prisma.user.findUnique({
        where: {
          id: parsedUserId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          phone: true,
          isVerified: true,
          rating: true,
          reviewCount: true,
          createdAt: true,
        },
      }),
    null
  );

  if (!user) {
    return null;
  }

  return {
    id: String(user.id),
    name: formatUserDisplayName(user.name, user.email),
    avatarUrl: resolveProfileAvatarUrl(user.avatarUrl),
    rating: Number((convertDecimalToNumber(user.rating) ?? 0).toFixed(1)),
    reviewCount: user.reviewCount,
    joinedAt: user.createdAt,
    isVerified: Boolean(user.isVerified && user.phone),
  };
}

export async function getPublicUserReviewHighlightsByUserId(
  userId: number | string,
  options: PublicUserReviewHighlightsOptions = {}
): Promise<PublicUserReviewHighlight[]> {
  const parsedUserId =
    typeof userId === "number" ? userId : Number.parseInt(userId, 10);
  if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
    return [];
  }

  const take = normalizeReviewHighlightsLimit(options.limit);

  const rows = await withDatabaseReadFallback(
    "getPublicUserReviewHighlightsByUserId",
    () =>
      prisma.review.findMany({
        where: {
          revieweeId: parsedUserId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          post: {
            select: {
              id: true,
              title: true,
              category: {
                select: {
                  name: true,
                  slug: true,
                },
              },
              address: {
                select: {
                  city: true,
                  state: true,
                },
              },
            },
          },
        },
      }),
    [] as Array<{
      id: number;
      rating: Prisma.Decimal;
      comment: string | null;
      createdAt: Date;
      reviewer: {
        id: number;
        name: string | null;
        email: string;
        avatarUrl: string | null;
      };
      post: {
        id: number;
        title: string;
        category: {
          name: string;
          slug: string;
        } | null;
        address: {
          city: string;
          state: string;
        } | null;
      };
    }>
  );

  return rows.map((row) => ({
    id: String(row.id),
    rating: Number((convertDecimalToNumber(row.rating) ?? 0).toFixed(1)),
    comment: row.comment?.trim() || null,
    createdAt: row.createdAt,
    reviewer: {
      id: String(row.reviewer.id),
      name: formatUserDisplayName(row.reviewer.name, row.reviewer.email),
      avatarUrl: resolveProfileAvatarUrl(row.reviewer.avatarUrl),
    },
    post: {
      id: String(row.post.id),
      title: row.post.title,
      category: formatReviewPostCategory(row.post.category),
      location: formatReviewPostLocation(row.post.address),
    },
  }));
}

export async function getListingProductById(id: string) {
  const listingId = parseListingId(id);
  if (!listingId) {
    return null;
  }

  const record = await withDatabaseReadFallback(
    "getListingProductById",
    () =>
      prisma.post.findFirst({
        where: {
          id: listingId,
          status: "ACTIVE",
          publishedAt: {
            not: null,
          },
        },
        select: listingSelect,
      }),
    null
  );

  return record ? mapListingRecordToProduct(record) : null;
}

export async function getListingProductPayloadById(
  id: string
): Promise<ListingProductPayload | null> {
  const product = await getListingProductById(id);
  return product ? serializeListingProduct(product) : null;
}
