import "server-only";

import type { Product } from "@/data/marketplaceData";
import {
  serializeListingProduct,
  type ListingProductPayload,
} from "@/data/listings";
import type { Prisma } from "../../generated/prisma/client";
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar";
import { prisma } from "@/lib/prisma";

export const MARKETPLACE_DEFAULT_PAGE_SIZE = 10;
export const MARKETPLACE_MAX_PAGE_SIZE = 30;

const DEFAULT_IMAGE_URL =
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&h=900&fit=crop";

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
  createdAt: true,
  author: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.PostSelect;

type ListingRecord = Prisma.PostGetPayload<{ select: typeof listingSelect }>;

type MarketplaceListingsPageOptions = {
  limit?: number;
  cursor?: number | string | null;
};

type FindManyListingsPageOptions = {
  limit: number;
  cursorId: number | null;
};

type ListingsByUserOptions = {
  includeInactive?: boolean;
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

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
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
  const rating =
    reviewCount > 0
      ? Number(
          (
            reviewRatings.reduce((sum, value) => sum + value, 0) / reviewCount
          ).toFixed(1)
        )
      : undefined;

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
    rating,
    featured: record.featured,
    reviewCount: reviewCount > 0 ? reviewCount : undefined,
    description: record.description ?? undefined,
    ownerId: String(record.author.id),
    ownerName,
    ownerImage: resolveProfileAvatarUrl(record.author.avatarUrl),
    ownerTag: "Verified Seller",
  };
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

async function findManyListingsPage({
  limit,
  cursorId,
}: FindManyListingsPageOptions) {
  return prisma.post.findMany({
    where: {
      status: "ACTIVE",
      publishedAt: {
        not: null,
      },
      ...(cursorId
        ? {
            id: {
              lt: cursorId,
            },
          }
        : {}),
    },
    orderBy: {
      id: "desc",
    },
    take: limit + 1,
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
  const cursorId = parseListingCursor(options.cursor);
  const records = await withDatabaseReadFallback(
    "getMarketplaceListingProductsPayloadPage",
    () => findManyListingsPage({ limit, cursorId }),
    [] as ListingRecord[]
  );

  const hasMore = records.length > limit;
  const visibleRecords = hasMore ? records.slice(0, limit) : records;
  const products = visibleRecords.map((record) =>
    serializeListingProduct(mapListingRecordToProduct(record))
  );
  const nextCursor =
    hasMore && visibleRecords.length > 0
      ? String(visibleRecords[visibleRecords.length - 1].id)
      : null;

  return {
    products,
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
        },
      }),
    null
  );

  if (!user) {
    return null;
  }

  return {
    id: String(user.id),
    name: user.name?.trim() || user.email.split("@")[0] || "User",
  };
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
