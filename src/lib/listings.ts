import "server-only";

import type { Product } from "@/data/marketplaceData";
import {
  serializeListingProduct,
  type ListingProductPayload,
} from "@/data/listings";
import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const MARKETPLACE_DEFAULT_PAGE_SIZE = 10;
export const MARKETPLACE_MAX_PAGE_SIZE = 30;

const DEFAULT_IMAGE_URL =
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&h=900&fit=crop";

const listingSelect = {
  id: true,
  title: true,
  content: true,
  category: true,
  categories: true,
  listingType: true,
  sellPrice: true,
  rentHourly: true,
  rentDaily: true,
  rentWeekly: true,
  rentMonthly: true,
  image: true,
  images: true,
  location: true,
  features: true,
  featured: true,
  rating: true,
  reviewCount: true,
  createdAt: true,
  author: {
    select: {
      id: true,
      name: true,
      email: true,
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

  return (
    code === "P1001" ||
    message.includes("Can't reach database server") ||
    message.includes("DatabaseNotReachable") ||
    name.includes("DatabaseNotReachable")
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

function normalizeImageList(input: { image: string | null; images: string[] }) {
  const ordered = [
    ...(typeof input.image === "string" ? [input.image] : []),
    ...input.images,
  ]
    .map((value) => value.trim())
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
  const normalizedImages = normalizeImageList({
    image: record.image,
    images: record.images,
  });
  const ownerName =
    record.author.name?.trim() ||
    record.author.email.split("@")[0] ||
    "User";

  return {
    id: String(record.id),
    title: record.title,
    type: listingType,
    price: supportsSell ? (record.sellPrice ?? null) : null,
    rentPrices:
      supportsRent
        ? {
            hourly: record.rentHourly ?? null,
            daily: record.rentDaily ?? null,
            weekly: record.rentWeekly ?? null,
            monthly: record.rentMonthly ?? null,
          }
        : null,
    category: record.category,
    image: normalizedImages.primaryImage,
    images: normalizedImages.images,
    location: record.location,
    distance: 0,
    postedAt: record.createdAt,
    featured: record.featured,
    rating: record.rating ?? undefined,
    reviewCount: record.reviewCount ?? undefined,
    description: record.content ?? undefined,
    features: record.features.length > 0 ? record.features : undefined,
    ownerId: String(record.author.id),
    ownerName,
    ownerTag: "Verified Seller",
  };
}

async function findManyListings() {
  return prisma.post.findMany({
    where: {
      published: true,
      listingType: {
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
      published: true,
      listingType: {
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

async function findManyListingsByAuthorId(authorId: number) {
  return prisma.post.findMany({
    where: {
      authorId,
      published: true,
      listingType: {
        not: null,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: listingSelect,
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
  userId: number | string
) {
  const parsedUserId =
    typeof userId === "number" ? userId : Number.parseInt(userId, 10);
  if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
    return [];
  }

  const records = await withDatabaseReadFallback(
    "getMarketplaceListingProductsByUserId",
    () => findManyListingsByAuthorId(parsedUserId),
    [] as ListingRecord[]
  );
  return records.map(mapListingRecordToProduct);
}

export async function getMarketplaceListingProductsPayloadByUserId(
  userId: number | string
) {
  const products = await getMarketplaceListingProductsByUserId(userId);
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
          published: true,
          listingType: {
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
