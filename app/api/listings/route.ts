import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  CUSTOM_SESSION_COOKIE_NAME,
  verifyCustomSessionToken,
} from "@/lib/custom-session";
import {
  getMarketplaceListingProductsPayloadPage,
  MARKETPLACE_DEFAULT_PAGE_SIZE,
} from "@/lib/listings";
import { prisma } from "@/lib/prisma";

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
};

const VALID_AGE_UNITS = new Set(["days", "months", "years"]);
const MAX_IMAGE_COUNT = 3;

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
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // No-op in this route. Session refresh is handled elsewhere.
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name.trim()
      : "";

  return {
    email: user.email.toLowerCase(),
    name: metadataName || null,
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
    const ageUnit =
      typeof body.ageUnit === "string" ? body.ageUnit.trim().toLowerCase() : "";
    const purposes = parsePurposeList(body.purposes);
    const sellPrice = parseNonNegativeInt(body.sellPrice);
    const rentPrices = parseRentPrices(body.rentPrices);
    const imageUrls = uniqueStringArray(body.imageUrls).slice(0, MAX_IMAGE_COUNT);
    const locationRaw =
      typeof body.location === "string" ? body.location.trim() : "";
    const location = locationRaw || "Bangalore";
    const ageValue = parseNonNegativeFloat(body.ageValue);

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

    const normalizedAgeUnit = VALID_AGE_UNITS.has(ageUnit) ? ageUnit : null;
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
      },
      select: {
        id: true,
      },
    });

    const post = await prisma.post.create({
      data: {
        title,
        content: description,
        published: true,
        authorId: user.id,
        listingType,
        category: categories[0],
        categories,
        location,
        ageValue,
        ageUnit: normalizedAgeUnit,
        sellPrice: supportsSell ? (sellPrice ?? null) : null,
        rentHourly: supportsRent ? rentPrices.hourly : null,
        rentDaily: supportsRent ? rentPrices.daily : null,
        rentWeekly: supportsRent ? rentPrices.weekly : null,
        rentMonthly: supportsRent ? rentPrices.monthly : null,
        image: imageUrls[0],
        images: imageUrls,
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json(
      {
        id: String(post.id),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to save listing right now. Please try again." },
      { status: 500 }
    );
  }
}
