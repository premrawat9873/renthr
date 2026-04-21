import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { resolveAuthenticatedUserId } from "@/lib/address-utils";
import { getCurrentUserInfo } from "@/lib/current-user";
import { isCurrentUserAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ListingPurpose = "sell" | "rent";
type StoredListingType = "SELL" | "RENT" | "BOTH";

type UpdateListingRequestBody = {
  title?: unknown;
  description?: unknown;
  location?: unknown;
  purposes?: unknown;
  rentPrices?: unknown;
  sellPrice?: unknown;
  rentDailyPrice?: unknown;
  featured?: unknown;
};

const LOCATION_PINCODE_PATTERN = /^\d{6}$/;

function parseListingId(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
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

function parseRentPriceInputs(value: unknown) {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;

  const hasHourly = Boolean(source && Object.prototype.hasOwnProperty.call(source, "hourly"));
  const hasDaily = Boolean(source && Object.prototype.hasOwnProperty.call(source, "daily"));
  const hasWeekly = Boolean(source && Object.prototype.hasOwnProperty.call(source, "weekly"));
  const hasMonthly = Boolean(source && Object.prototype.hasOwnProperty.call(source, "monthly"));

  return {
    hasHourly,
    hasDaily,
    hasWeekly,
    hasMonthly,
    hourly: hasHourly ? parseOptionalNonNegativeAmount(source?.hourly) : null,
    daily: hasDaily ? parseOptionalNonNegativeAmount(source?.daily) : null,
    weekly: hasWeekly ? parseOptionalNonNegativeAmount(source?.weekly) : null,
    monthly: hasMonthly ? parseOptionalNonNegativeAmount(source?.monthly) : null,
  };
}

function parseOptionalNonNegativeAmount(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Number.NaN;
  }

  return parsed;
}

function toPaise(value: number | null) {
  if (value == null) {
    return null;
  }

  return Math.round(value * 100);
}

function fromPaise(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value / 100;
}

function toLocationParts(input: string) {
  const normalized = input.trim();
  const [cityPart, statePart] = normalized
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return {
    line1: normalized,
    city: cityPart || normalized,
    state: statePart || "Unknown",
  };
}

function parseListingLocationInput(value: unknown) {
  if (typeof value === "string") {
    const locationParts = toLocationParts(value);
    if (!locationParts.line1) {
      return null;
    }

    return {
      line1: locationParts.line1,
      city: locationParts.city,
      state: locationParts.state,
      pincode: "",
      country: "IN",
      landmark: null as string | null,
      latitude: null as number | null,
      longitude: null as number | null,
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
  const latitude = parseCoordinate(source.latitude ?? source.lat, -90, 90);
  const longitude = parseCoordinate(source.longitude ?? source.lng, -180, 180);
  const hasCoordinates = latitude != null && longitude != null;

  if (!line1 && city && state) {
    line1 = `${city}, ${state}`;
  }

  if (!line1 && hasCoordinates) {
    line1 = "Pinned location";
  }

  if (!line1 && !city && !state && !pincode && !hasCoordinates) {
    return null;
  }

  return {
    line1,
    city,
    state,
    pincode,
    country,
    landmark,
    latitude: hasCoordinates ? latitude : null,
    longitude: hasCoordinates ? longitude : null,
  };
}

function isValidLocationPincode(value: string) {
  return value.length === 0 || LOCATION_PINCODE_PATTERN.test(value);
}

function getStoredListingTypeFromPurposes(
  purposes: ListingPurpose[]
): StoredListingType {
  const supportsSell = purposes.includes("sell");
  const supportsRent = purposes.includes("rent");

  if (supportsSell && supportsRent) {
    return "BOTH";
  }

  return supportsRent ? "RENT" : "SELL";
}

function getListingTypeSupportFlags(listingType: StoredListingType) {
  const supportsSell = listingType === "SELL" || listingType === "BOTH";
  const supportsRent = listingType === "RENT" || listingType === "BOTH";

  return {
    supportsSell,
    supportsRent,
  };
}

function formatLocationLabel(address: { city: string; state: string } | null) {
  if (!address) {
    return "Location not specified";
  }

  const parts = [address.city, address.state]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return parts.length > 0 ? parts.join(", ") : "Location not specified";
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseListingId(id);
    if (!listingId) {
      return NextResponse.json({ error: "Invalid listing id." }, { status: 400 });
    }

    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to delete listings." },
        { status: 401 }
      );
    }

    const listing = await prisma.post.findUnique({
      where: { id: listingId },
      select: { id: true, authorId: true },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    // Allow owners or site admins to delete listings
    const currentUser = await getCurrentUserInfo();
    const isAdmin = currentUser ? await isCurrentUserAdmin() : false;

    if (!isAdmin && listing.authorId !== userId) {
      return NextResponse.json(
        { error: "You are not allowed to delete this listing." },
        { status: 403 }
      );
    }

    await prisma.post.delete({ where: { id: listingId } });

    return NextResponse.json({ id: String(listing.id), deleted: true });
  } catch (error) {
    console.error("[listings.delete] Failed to delete listing", error);
    return NextResponse.json(
      { error: "Unable to delete listing right now." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseListingId(id);
    if (!listingId) {
      return NextResponse.json({ error: "Invalid listing id." }, { status: 400 });
    }

    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to edit listings." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | UpdateListingRequestBody
      | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const hasTitle = Object.prototype.hasOwnProperty.call(body, "title");
    const hasDescription = Object.prototype.hasOwnProperty.call(body, "description");
    const hasLocation = Object.prototype.hasOwnProperty.call(body, "location");
    const hasPurposes = Object.prototype.hasOwnProperty.call(body, "purposes");
    const hasRentPrices = Object.prototype.hasOwnProperty.call(body, "rentPrices");
    const hasSellPrice = Object.prototype.hasOwnProperty.call(body, "sellPrice");
    const hasRentDailyPrice = Object.prototype.hasOwnProperty.call(body, "rentDailyPrice");
    const hasFeatured = Object.prototype.hasOwnProperty.call(body, "featured");

    if (
      !hasTitle &&
      !hasDescription &&
      !hasLocation &&
      !hasPurposes &&
      !hasRentPrices &&
      !hasSellPrice &&
      !hasRentDailyPrice &&
      !hasFeatured
    ) {
      return NextResponse.json(
        { error: "At least one field is required to update the listing." },
        { status: 400 }
      );
    }

    if (hasFeatured && typeof body.featured !== "boolean") {
      return NextResponse.json(
        { error: "Featured flag must be true or false." },
        { status: 400 }
      );
    }

    const normalizedTitle = hasTitle ? normalizeText(body.title) : "";
    if (hasTitle && normalizedTitle.length < 3) {
      return NextResponse.json(
        { error: "Title must be at least 3 characters." },
        { status: 400 }
      );
    }

    const normalizedDescription = hasDescription ? normalizeText(body.description) : "";
    if (hasDescription && normalizedDescription.length < 10) {
      return NextResponse.json(
        { error: "Description must be at least 10 characters." },
        { status: 400 }
      );
    }

    const normalizedLocation = hasLocation ? normalizeText(body.location) : "";
    if (hasLocation && typeof body.location === "string" && normalizedLocation.length < 2) {
      return NextResponse.json(
        { error: "Location must be at least 2 characters." },
        { status: 400 }
      );
    }

    const parsedLocation = hasLocation
      ? parseListingLocationInput(body.location)
      : null;
    if (hasLocation && !parsedLocation) {
      return NextResponse.json(
        { error: "Location details are invalid." },
        { status: 400 }
      );
    }

    if (parsedLocation && parsedLocation.line1.length < 2) {
      return NextResponse.json(
        { error: "Location address line must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (parsedLocation && parsedLocation.city.length < 2) {
      return NextResponse.json(
        { error: "Location city must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (parsedLocation && parsedLocation.state.length < 2) {
      return NextResponse.json(
        { error: "Location state must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (parsedLocation && !isValidLocationPincode(parsedLocation.pincode)) {
      return NextResponse.json(
        { error: "Location pincode must be a 6-digit number." },
        { status: 400 }
      );
    }

    const parsedPurposes = hasPurposes ? parsePurposeList(body.purposes) : [];
    if (hasPurposes && parsedPurposes.length === 0) {
      return NextResponse.json(
        { error: "Choose at least one listing purpose." },
        { status: 400 }
      );
    }

    const parsedSellPrice = hasSellPrice
      ? parseOptionalNonNegativeAmount(body.sellPrice)
      : null;
    if (hasSellPrice && Number.isNaN(parsedSellPrice)) {
      return NextResponse.json(
        { error: "Sell price must be a valid non-negative number." },
        { status: 400 }
      );
    }

    const parsedRentDailyPrice = hasRentDailyPrice
      ? parseOptionalNonNegativeAmount(body.rentDailyPrice)
      : null;
    if (hasRentDailyPrice && Number.isNaN(parsedRentDailyPrice)) {
      return NextResponse.json(
        { error: "Daily rent must be a valid non-negative number." },
        { status: 400 }
      );
    }

    const parsedRentPrices = hasRentPrices
      ? parseRentPriceInputs(body.rentPrices)
      : {
          hasHourly: false,
          hasDaily: false,
          hasWeekly: false,
          hasMonthly: false,
          hourly: null,
          daily: null,
          weekly: null,
          monthly: null,
        };

    if (
      Number.isNaN(parsedRentPrices.hourly) ||
      Number.isNaN(parsedRentPrices.daily) ||
      Number.isNaN(parsedRentPrices.weekly) ||
      Number.isNaN(parsedRentPrices.monthly)
    ) {
      return NextResponse.json(
        { error: "Rent prices must be valid non-negative numbers." },
        { status: 400 }
      );
    }

    const listing = await prisma.post.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        authorId: true,
        listingType: true,
        sellPricePaise: true,
        rentHourlyPaise: true,
        rentDailyPaise: true,
        rentWeeklyPaise: true,
        rentMonthlyPaise: true,
        addressId: true,
        address: {
          select: {
            line1: true,
            landmark: true,
            city: true,
            state: true,
            pincode: true,
            country: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    if (listing.authorId !== userId) {
      return NextResponse.json(
        { error: "You are not allowed to edit this listing." },
        { status: 403 }
      );
    }

    const targetListingType = hasPurposes
      ? getStoredListingTypeFromPurposes(parsedPurposes)
      : listing.listingType;
    const { supportsSell: targetSupportsSell, supportsRent: targetSupportsRent } =
      getListingTypeSupportFlags(targetListingType);

    let nextSellPricePaise = listing.sellPricePaise;
    let nextRentHourlyPaise = listing.rentHourlyPaise;
    let nextRentDailyPaise = listing.rentDailyPaise;
    let nextRentWeeklyPaise = listing.rentWeeklyPaise;
    let nextRentMonthlyPaise = listing.rentMonthlyPaise;

    if (hasSellPrice) {
      nextSellPricePaise = toPaise(parsedSellPrice);
    }

    if (hasRentDailyPrice) {
      nextRentDailyPaise = toPaise(parsedRentDailyPrice);
    }

    if (parsedRentPrices.hasHourly) {
      nextRentHourlyPaise = toPaise(parsedRentPrices.hourly);
    }

    if (parsedRentPrices.hasDaily) {
      nextRentDailyPaise = toPaise(parsedRentPrices.daily);
    }

    if (parsedRentPrices.hasWeekly) {
      nextRentWeeklyPaise = toPaise(parsedRentPrices.weekly);
    }

    if (parsedRentPrices.hasMonthly) {
      nextRentMonthlyPaise = toPaise(parsedRentPrices.monthly);
    }

    if (!targetSupportsSell) {
      nextSellPricePaise = null;
    }

    if (!targetSupportsRent) {
      nextRentHourlyPaise = null;
      nextRentDailyPaise = null;
      nextRentWeeklyPaise = null;
      nextRentMonthlyPaise = null;
    }

    if (targetSupportsSell && nextSellPricePaise == null) {
      return NextResponse.json(
        { error: "Sell listings require a selling price." },
        { status: 400 }
      );
    }

    if (
      targetSupportsRent &&
      nextRentHourlyPaise == null &&
      nextRentDailyPaise == null &&
      nextRentWeeklyPaise == null &&
      nextRentMonthlyPaise == null
    ) {
      return NextResponse.json(
        { error: "Rent listings require at least one rent price." },
        { status: 400 }
      );
    }

    const updatedListing = await prisma.$transaction(async (tx) => {
      const updateData: {
        title?: string;
        description?: string;
        listingType?: StoredListingType;
        sellPricePaise?: number | null;
        rentHourlyPaise?: number | null;
        rentDailyPaise?: number | null;
        rentWeeklyPaise?: number | null;
        rentMonthlyPaise?: number | null;
        addressId?: number | null;
        featured?: boolean;
      } = {};

      if (hasTitle) {
        updateData.title = normalizedTitle;
      }

      if (hasDescription) {
        updateData.description = normalizedDescription;
      }

      if (hasPurposes) {
        updateData.listingType = targetListingType;
      }

      if (hasSellPrice || hasPurposes) {
        updateData.sellPricePaise = nextSellPricePaise;
      }

      if (hasRentDailyPrice || hasRentPrices || hasPurposes) {
        updateData.rentHourlyPaise = nextRentHourlyPaise;
        updateData.rentDailyPaise = nextRentDailyPaise;
        updateData.rentWeeklyPaise = nextRentWeeklyPaise;
        updateData.rentMonthlyPaise = nextRentMonthlyPaise;
      }

      if (hasFeatured) {
        updateData.featured = Boolean(body.featured);
      }

      if (parsedLocation) {
        const resolvedPincode =
          parsedLocation.pincode || listing.address?.pincode || "000000";
        const resolvedCountry =
          parsedLocation.country || listing.address?.country || "IN";
        const resolvedLandmark =
          parsedLocation.landmark ?? listing.address?.landmark ?? null;
        const resolvedLatitude =
          parsedLocation.latitude ?? listing.address?.latitude ?? null;
        const resolvedLongitude =
          parsedLocation.longitude ?? listing.address?.longitude ?? null;

        if (listing.addressId) {
          await tx.address.update({
            where: { id: listing.addressId },
            data: {
              line1: parsedLocation.line1,
              landmark: resolvedLandmark,
              city: parsedLocation.city,
              state: parsedLocation.state,
              pincode: resolvedPincode,
              country: resolvedCountry,
              latitude: resolvedLatitude,
              longitude: resolvedLongitude,
            },
          });
        } else {
          const createdAddress = await tx.address.create({
            data: {
              userId,
              line1: parsedLocation.line1,
              landmark: parsedLocation.landmark,
              city: parsedLocation.city,
              state: parsedLocation.state,
              pincode: resolvedPincode,
              country: resolvedCountry,
              latitude: parsedLocation.latitude,
              longitude: parsedLocation.longitude,
            },
            select: { id: true },
          });

          updateData.addressId = createdAddress.id;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await tx.post.update({
          where: { id: listingId },
          data: updateData,
        });
      }

      return tx.post.findUnique({
        where: { id: listingId },
        select: {
          id: true,
          title: true,
          description: true,
          listingType: true,
          sellPricePaise: true,
          rentHourlyPaise: true,
          rentDailyPaise: true,
          rentWeeklyPaise: true,
          rentMonthlyPaise: true,
          featured: true,
          address: {
            select: {
              line1: true,
              city: true,
              state: true,
              pincode: true,
            },
          },
        },
      });
    });

    if (!updatedListing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    const supportsSell =
      updatedListing.listingType === "SELL" || updatedListing.listingType === "BOTH";
    const supportsRent =
      updatedListing.listingType === "RENT" || updatedListing.listingType === "BOTH";
    const listingType = supportsSell
      ? supportsRent
        ? "both"
        : "sell"
      : "rent";

    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/my-posts");
    revalidatePath('/profile/[id]', 'page');
    revalidatePath(`/product/${updatedListing.id}`);

    return NextResponse.json({
      listing: {
        id: String(updatedListing.id),
        title: updatedListing.title,
        description: updatedListing.description || "",
        type: listingType,
        location: formatLocationLabel(updatedListing.address),
        locationDetails: updatedListing.address
          ? {
              line1: updatedListing.address.line1,
              city: updatedListing.address.city,
              state: updatedListing.address.state,
              pincode: updatedListing.address.pincode,
            }
          : null,
        featured: updatedListing.featured,
        price: supportsSell ? fromPaise(updatedListing.sellPricePaise) : null,
        rentPrices: supportsRent
          ? {
              hourly: fromPaise(updatedListing.rentHourlyPaise),
              daily: fromPaise(updatedListing.rentDailyPaise),
              weekly: fromPaise(updatedListing.rentWeeklyPaise),
              monthly: fromPaise(updatedListing.rentMonthlyPaise),
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[listings.patch] Failed to edit listing", error);
    return NextResponse.json(
      { error: "Unable to edit listing right now." },
      { status: 500 }
    );
  }
}
