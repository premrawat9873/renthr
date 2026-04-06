import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { resolveAuthenticatedUserId } from "@/lib/address-utils";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type UpdateListingRequestBody = {
  title?: unknown;
  description?: unknown;
  location?: unknown;
  sellPrice?: unknown;
  rentDailyPrice?: unknown;
  featured?: unknown;
};

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

    if (listing.authorId !== userId) {
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
    const hasSellPrice = Object.prototype.hasOwnProperty.call(body, "sellPrice");
    const hasRentDailyPrice = Object.prototype.hasOwnProperty.call(body, "rentDailyPrice");
    const hasFeatured = Object.prototype.hasOwnProperty.call(body, "featured");

    if (
      !hasTitle &&
      !hasDescription &&
      !hasLocation &&
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
    if (hasLocation && normalizedLocation.length < 2) {
      return NextResponse.json(
        { error: "Location must be at least 2 characters." },
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

    const listing = await prisma.post.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        authorId: true,
        listingType: true,
        addressId: true,
        address: {
          select: {
            city: true,
            state: true,
            pincode: true,
            country: true,
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

    if (hasSellPrice && listing.listingType === "RENT") {
      return NextResponse.json(
        { error: "Sell price cannot be set for rent-only listings." },
        { status: 400 }
      );
    }

    if (hasRentDailyPrice && listing.listingType === "SELL") {
      return NextResponse.json(
        { error: "Daily rent cannot be set for sell-only listings." },
        { status: 400 }
      );
    }

    const updatedListing = await prisma.$transaction(async (tx) => {
      const updateData: {
        title?: string;
        description?: string;
        sellPricePaise?: number | null;
        rentDailyPaise?: number | null;
        addressId?: number | null;
        featured?: boolean;
      } = {};

      if (hasTitle) {
        updateData.title = normalizedTitle;
      }

      if (hasDescription) {
        updateData.description = normalizedDescription;
      }

      if (hasSellPrice) {
        updateData.sellPricePaise = toPaise(parsedSellPrice);
      }

      if (hasRentDailyPrice) {
        updateData.rentDailyPaise = toPaise(parsedRentDailyPrice);
      }

      if (hasFeatured) {
        updateData.featured = Boolean(body.featured);
      }

      if (hasLocation) {
        const locationParts = toLocationParts(normalizedLocation);

        if (listing.addressId) {
          await tx.address.update({
            where: { id: listing.addressId },
            data: {
              line1: locationParts.line1,
              city: locationParts.city,
              state: locationParts.state,
              pincode: listing.address?.pincode || "000000",
              country: listing.address?.country || "IN",
            },
          });
        } else {
          const createdAddress = await tx.address.create({
            data: {
              userId,
              line1: locationParts.line1,
              city: locationParts.city,
              state: locationParts.state,
              pincode: "000000",
              country: "IN",
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
              city: true,
              state: true,
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

    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/my-posts");
    revalidatePath(`/profile/${userId}`);
    revalidatePath(`/product/${updatedListing.id}`);

    return NextResponse.json({
      listing: {
        id: String(updatedListing.id),
        title: updatedListing.title,
        description: updatedListing.description || "",
        location: formatLocationLabel(updatedListing.address),
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
