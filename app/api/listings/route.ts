import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  CUSTOM_SESSION_COOKIE_NAME,
  verifyCustomSessionToken,
} from "@/lib/custom-session";
import { getSupabaseAuthCookieOptions } from "@/lib/auth-cookie-options";
import {
  getMarketplaceListingProductsPayloadPage,
  MARKETPLACE_DEFAULT_PAGE_SIZE,
} from "@/lib/listings";
import { getAvatarUrlFromMetadata } from "@/lib/profile-avatar";
import { prisma } from "@/lib/prisma";
import { isSupabaseRefreshTokenNotFoundError } from "@/lib/supabase-auth-utils";

export const runtime = "nodejs";

type ListingPurpose = "sell" | "rent";
type StoredListingType = "SELL" | "RENT" | "BOTH";
type RentPriceKey = "hourly" | "daily" | "weekly" | "monthly";
type CreateListingBody = {
  title?: unknown;
  description?: unknown;
  categoryIds?: unknown;
  ageValue?: unknown;
  ageUnit?: unknown;
  purposes?: unknown;
  sellPrice?: unknown;
  rentPrices?: unknown;
  imageUrls?: unknown;
  location?: unknown;
  featured?: unknown;
};

const MAX_IMAGE_COUNT = 3;
const LOCATION_MIN_LENGTH = 2;
const LOCATION_PINCODE_PATTERN = /^\d{6}$/;
const LOCATION_PLACEHOLDER_VALUES = new Set(["unknown", "na", "n/a"]);

function normalizeCategorySlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatCategoryName(slug: string) {
  const words = slug
    .split("-")
    .map((word) => word.trim())
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return "Uncategorized";
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

type ParsedListingLocation = {
  line1: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  landmark: string | null;
  label: string | null;
  latitude: number | null;
  longitude: number | null;
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

function uniqueStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  );
}

function parseNonNegativeInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value >= 0 ? value : Number.NaN);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return Number.NaN;
    }
    return Math.floor(parsed);
  }

  if (value == null) {
    return null;
  }

  return Number.NaN;
}

function parseNonNegativeFloat(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Number.NaN;
  }

  return parsed;
}

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCoordinate(value: unknown, min: number, max: number) {
  if (value == null || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return Number(parsed.toFixed(7));
}

function parseListingLocation(value: unknown): ParsedListingLocation | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const [cityPart, statePart] = normalized
      .split(",")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    return {
      line1: normalized,
      city: cityPart || "",
      state: statePart || "",
      pincode: "",
      country: "IN",
      landmark: null,
      label: "Listing location",
      latitude: null,
      longitude: null,
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const city = normalizeText(source.city);
  const state = normalizeText(source.state);
  const pincode = normalizeText(source.pincode);
  let line1 = normalizeText(source.line1);
  const country = normalizeText(source.country).toUpperCase() || "IN";
  const landmark = normalizeText(source.landmark) || null;
  const label = normalizeText(source.label) || null;
  const latitude = parseCoordinate(source.latitude ?? source.lat, -90, 90);
  const longitude = parseCoordinate(source.longitude ?? source.lng, -180, 180);
  const hasCoordinates = latitude != null && longitude != null;

  if (!line1 && city && state) {
    line1 = `${city}, ${state}`;
  }

  if (!line1 && hasCoordinates) {
    line1 = "Pinned location";
  }

  const normalizedCity = city;
  const normalizedState = state;
  const normalizedPincode = pincode;

  if (!line1 && !normalizedCity && !normalizedState && !normalizedPincode && !hasCoordinates) {
    return null;
  }

  return {
    line1,
    city: normalizedCity,
    state: normalizedState,
    pincode: normalizedPincode,
    country,
    landmark,
    label,
    latitude: hasCoordinates ? latitude : null,
    longitude: hasCoordinates ? longitude : null,
  };
}

function isPlaceholderLocationValue(value: string) {
  return LOCATION_PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

function isValidLocationPincode(value: string) {
  return value.length === 0 || LOCATION_PINCODE_PATTERN.test(value);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function resolveAuthenticatedIdentity() {
  const cookieStore = await cookies();

  const customSession = verifyCustomSessionToken(
    cookieStore.get(CUSTOM_SESSION_COOKIE_NAME)?.value
  );

  if (customSession) {
    return {
      email: customSession.email.toLowerCase(),
      name: customSession.name,
      avatarUrl: null,
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: getSupabaseAuthCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // No-op in this route. Session refresh is handled elsewhere.
      },
    },
  });

  let user = null;

  try {
    const {
      data,
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return null;
    }

    user = data.user;
  } catch (error) {
    if (isSupabaseRefreshTokenNotFoundError(error)) {
      return null;
    }

    return null;
  }

  if (!user?.email) {
    return null;
  }

  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name.trim()
      : "";
  const metadataAvatarUrl = getAvatarUrlFromMetadata(user.user_metadata);

  return {
    email: user.email.toLowerCase(),
    name: metadataName || null,
    avatarUrl: metadataAvatarUrl,
  };
}

function parsePurposeList(value: unknown): ListingPurpose[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is ListingPurpose => item === "sell" || item === "rent");

  return Array.from(new Set(normalized));
}

function parseRentPrices(value: unknown) {
  const source =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  const parsed: Record<RentPriceKey, number | null> = {
    hourly: parseNonNegativeInt(source.hourly),
    daily: parseNonNegativeInt(source.daily),
    weekly: parseNonNegativeInt(source.weekly),
    monthly: parseNonNegativeInt(source.monthly),
  };

  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const cursorParam = searchParams.get("cursor");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN;

  const page = await getMarketplaceListingProductsPayloadPage({
    limit: Number.isFinite(parsedLimit) ? parsedLimit : MARKETPLACE_DEFAULT_PAGE_SIZE,
    cursor: cursorParam,
  });

  return NextResponse.json(page);
}

export async function POST(request: Request) {
  try {
    const identity = await resolveAuthenticatedIdentity();
    if (!identity) {
      return NextResponse.json(
        { error: "Please log in before creating a listing." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as CreateListingBody;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const categories = uniqueStringArray(body.categoryIds).slice(0, 2);
    const purposes = parsePurposeList(body.purposes);
    const sellPrice = parseNonNegativeInt(body.sellPrice);
    const rentPrices = parseRentPrices(body.rentPrices);
    const imageUrls = uniqueStringArray(body.imageUrls).slice(0, MAX_IMAGE_COUNT);
    const ageValue = parseNonNegativeFloat(body.ageValue);
    const location = parseListingLocation(body.location);
    const featured = parseBoolean(body.featured, false);

    if (title.length < 3) {
      return NextResponse.json(
        { error: "Title must be at least 3 characters." },
        { status: 400 }
      );
    }

    if (description.length < 10) {
      return NextResponse.json(
        { error: "Description must be at least 10 characters." },
        { status: 400 }
      );
    }

    if (categories.length === 0) {
      return NextResponse.json(
        { error: "Select at least one category." },
        { status: 400 }
      );
    }

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one image first." },
        { status: 400 }
      );
    }

    if (imageUrls.some((imageUrl) => !isHttpUrl(imageUrl))) {
      return NextResponse.json(
        { error: "One or more image URLs are invalid." },
        { status: 400 }
      );
    }

    if (purposes.length === 0) {
      return NextResponse.json(
        { error: "Choose at least one listing purpose." },
        { status: 400 }
      );
    }

    if (Number.isNaN(sellPrice)) {
      return NextResponse.json(
        { error: "Sell price must be a valid non-negative number." },
        { status: 400 }
      );
    }

    if (Object.values(rentPrices).some((value) => Number.isNaN(value))) {
      return NextResponse.json(
        { error: "Rent prices must be valid non-negative numbers." },
        { status: 400 }
      );
    }

    if (Number.isNaN(ageValue)) {
      return NextResponse.json(
        { error: "Product age must be a valid non-negative number." },
        { status: 400 }
      );
    }

    if (!location) {
      return NextResponse.json(
        { error: "City and state are required for listing location." },
        { status: 400 }
      );
    }

    if (location.line1.length < LOCATION_MIN_LENGTH) {
      return NextResponse.json(
        { error: "Location address line must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (location.city.length < LOCATION_MIN_LENGTH) {
      return NextResponse.json(
        { error: "Location city must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (location.state.length < LOCATION_MIN_LENGTH) {
      return NextResponse.json(
        { error: "Location state must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (isPlaceholderLocationValue(location.city)) {
      return NextResponse.json(
        { error: "Please provide an exact city for this listing." },
        { status: 400 }
      );
    }

    if (isPlaceholderLocationValue(location.state)) {
      return NextResponse.json(
        { error: "Please provide an exact state for this listing." },
        { status: 400 }
      );
    }

    if (!isValidLocationPincode(location.pincode)) {
      return NextResponse.json(
        { error: "Location pincode must be a 6-digit number." },
        { status: 400 }
      );
    }

    const supportsSell = purposes.includes("sell");
    const supportsRent = purposes.includes("rent");
    const listingType: StoredListingType =
      supportsSell && supportsRent
        ? "BOTH"
        : supportsRent
          ? "RENT"
          : "SELL";
    const hasRentPrice =
      rentPrices.hourly != null ||
      rentPrices.daily != null ||
      rentPrices.weekly != null ||
      rentPrices.monthly != null;

    if (supportsSell && sellPrice == null) {
      return NextResponse.json(
        { error: "Sell listings require a selling price." },
        { status: 400 }
      );
    }

    if (supportsRent && !hasRentPrice) {
      return NextResponse.json(
        { error: "Rent listings require at least one rent price." },
        { status: 400 }
      );
    }

    const primaryCategoryInput = categories[0] ?? "";
    const primaryCategorySlug = normalizeCategorySlug(primaryCategoryInput);
    if (!primaryCategorySlug) {
      return NextResponse.json(
        { error: "Select a valid category." },
        { status: 400 }
      );
    }

    const primaryCategoryName = formatCategoryName(primaryCategorySlug);
    const categoryBySlug = await prisma.category.findUnique({
      where: { slug: primaryCategorySlug },
      select: { id: true },
    });

    const categoryByName =
      categoryBySlug ??
      (await prisma.category.findUnique({
        where: { name: primaryCategoryName },
        select: { id: true },
      }));

    const category =
      categoryByName ??
      (await prisma.category.create({
        data: {
          name: primaryCategoryName,
          slug: primaryCategorySlug,
          isActive: true,
        },
        select: { id: true },
      }));

    const user = await prisma.user.upsert({
      where: {
        email: identity.email,
      },
      update: identity.name
        ? {
            name: identity.name,
          }
        : {},
      create: {
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
      },
      select: {
        id: true,
      },
    });

    const post = await prisma.post.create({
      data: {
        title,
        description,
        status: "ACTIVE",
        author: {
          connect: {
            id: user.id,
          },
        },
        category: {
          connect: {
            id: category.id,
          },
        },
        listingType,
        featured,
        publishedAt: new Date(),
        address: {
          create: {
            label: location.label || "Listing location",
            line1: location.line1,
            landmark: location.landmark,
            city: location.city,
            state: location.state,
            pincode: location.pincode || "000000",
            country: location.country || "IN",
            latitude: location.latitude,
            longitude: location.longitude,
            userId: user.id,
          },
        },
        sellPricePaise:
          supportsSell && sellPrice != null ? sellPrice * 100 : null,
        rentHourlyPaise:
          supportsRent && rentPrices.hourly != null
            ? rentPrices.hourly * 100
            : null,
        rentDailyPaise:
          supportsRent && rentPrices.daily != null
            ? rentPrices.daily * 100
            : null,
        rentWeeklyPaise:
          supportsRent && rentPrices.weekly != null
            ? rentPrices.weekly * 100
            : null,
        rentMonthlyPaise:
          supportsRent && rentPrices.monthly != null
            ? rentPrices.monthly * 100
            : null,
        images: {
          create: imageUrls.map((url, index) => ({
            url,
            sortOrder: index,
            isPrimary: index === 0,
          })),
        },
      },
      select: {
        id: true,
      },
    });

    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/my-posts");
    revalidatePath(`/profile/${user.id}`);
    revalidatePath(`/product/${post.id}`);

    return NextResponse.json(
      {
        id: String(post.id),
      },
      { status: 201 }
    );
  } catch (error) {
    if (isDatabaseNotReachableError(error)) {
      return NextResponse.json(
        {
          error:
            "Database is temporarily unreachable. Please retry in a moment.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Unable to save listing right now. Please try again." },
      { status: 500 }
    );
  }
}
