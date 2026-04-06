import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { resolveAuthenticatedUserId } from "@/lib/address-utils";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseListingId(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
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
        { error: "Please log in to update availability." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { available?: unknown }
      | null;

    if (!body || typeof body.available !== "boolean") {
      return NextResponse.json(
        { error: "Missing availability flag." },
        { status: 400 }
      );
    }

    const listing = await prisma.post.findUnique({
      where: { id: listingId },
      select: { id: true, authorId: true, status: true, publishedAt: true },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    if (!listing.publishedAt) {
      return NextResponse.json(
        { error: "Publish the listing before changing availability." },
        { status: 400 }
      );
    }

    if (listing.authorId !== userId) {
      return NextResponse.json(
        { error: "You are not allowed to update this listing." },
        { status: 403 }
      );
    }

    const nextStatus = body.available ? "ACTIVE" : "INACTIVE";

    const updated = await prisma.post.update({
      where: { id: listingId },
      data: { status: nextStatus },
      select: { id: true, status: true },
    });

    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/my-posts");
    revalidatePath(`/profile/${listing.authorId}`);
    revalidatePath(`/product/${updated.id}`);

    return NextResponse.json({
      id: String(updated.id),
      available: updated.status === "ACTIVE",
    });
  } catch (error) {
    console.error("[availability] Failed to update", error);
    return NextResponse.json(
      { error: "Unable to update availability right now." },
      { status: 500 }
    );
  }
}
