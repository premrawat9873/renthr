import { NextResponse } from "next/server";

import { resolveAuthenticatedUserId } from "@/lib/address-utils";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to view your wishlist." },
        { status: 401 }
      );
    }

    const items = await prisma.wishlistItem.findMany({
      where: { userId },
      select: { postId: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ids: items.map((item) => String(item.postId)),
    });
  } catch (error) {
    console.error("[wishlist] Failed to fetch wishlist", error);
    return NextResponse.json(
      { error: "Unable to load wishlist right now." },
      { status: 500 }
    );
  }
}
