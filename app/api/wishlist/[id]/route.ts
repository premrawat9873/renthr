import { NextResponse } from "next/server";

import { resolveAuthenticatedUserId } from "@/lib/address-utils";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseListingId(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

async function ensureListingExists(listingId: number) {
  const listing = await prisma.post.findUnique({
    where: { id: listingId },
    select: { id: true },
  });
  return Boolean(listing);
}

export async function POST(
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
        { error: "Please log in to save items." },
        { status: 401 }
      );
    }

    const exists = await ensureListingExists(listingId);
    if (!exists) {
      return NextResponse.json(
        { error: "Listing not found." },
        { status: 404 }
      );
    }

    await prisma.wishlistItem.upsert({
      where: {
        userId_postId: {
          userId,
          postId: listingId,
        },
      },
      update: {},
      create: {
        userId,
        postId: listingId,
      },
    });

    return NextResponse.json({ liked: true });
  } catch (error) {
    console.error("[wishlist] Failed to add", error);
    return NextResponse.json(
      { error: "Unable to update wishlist." },
      { status: 500 }
    );
  }
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
        { error: "Please log in to manage your wishlist." },
        { status: 401 }
      );
    }

    await prisma.wishlistItem
      .delete({
        where: {
          userId_postId: {
            userId,
            postId: listingId,
          },
        },
      })
      .catch(() => null);

    return NextResponse.json({ liked: false });
  } catch (error) {
    console.error("[wishlist] Failed to remove", error);
    return NextResponse.json(
      { error: "Unable to update wishlist." },
      { status: 500 }
    );
  }
}
