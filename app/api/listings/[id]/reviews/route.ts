import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { resolveAuthenticatedUserId } from "@/lib/address-utils";
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ReviewRequestBody = {
  rating?: unknown;
  comment?: unknown;
};

type RatingBreakdown = {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5": number;
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

function parseRating(value: unknown) {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }

  if (parsed < 1 || parsed > 5) {
    return null;
  }

  return parsed;
}

function normalizeComment(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function decimalToNumber(value: unknown) {
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

function buildRatingBreakdown(ratings: number[]) {
  const breakdown: RatingBreakdown = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  };

  ratings.forEach((rating) => {
    const key = String(Math.min(5, Math.max(1, Math.round(rating)))) as keyof RatingBreakdown;
    breakdown[key] += 1;
  });

  return breakdown;
}

function formatReviewerName(name: string | null, email: string) {
  const normalizedName = name?.trim() ?? "";
  if (normalizedName.length > 0) {
    return normalizedName;
  }

  const emailPrefix = email.split("@")[0]?.trim();
  return emailPrefix || "User";
}

async function findListingForReview(listingId: number) {
  return prisma.post.findFirst({
    where: {
      id: listingId,
      status: "ACTIVE",
      publishedAt: {
        not: null,
      },
    },
    select: {
      id: true,
      authorId: true,
    },
  });
}

async function getPostReviews(postId: number, currentUserId: number | null) {
  const reviewRows = await prisma.review.findMany({
    where: { postId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      reviewerId: true,
      reviewer: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  const reviews = reviewRows.map((review) => {
    const rating = decimalToNumber(review.rating) ?? 0;

    return {
      id: String(review.id),
      rating: Number(rating.toFixed(1)),
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
      isCurrentUser: currentUserId != null && review.reviewerId === currentUserId,
      reviewer: {
        id: String(review.reviewer.id),
        name: formatReviewerName(review.reviewer.name, review.reviewer.email),
        avatarUrl: resolveProfileAvatarUrl(review.reviewer.avatarUrl),
      },
    };
  });

  const ratingValues = reviews.map((review) => review.rating);
  const reviewCount = ratingValues.length;
  const averageRating =
    reviewCount > 0
      ? Number(
          (ratingValues.reduce((sum, rating) => sum + rating, 0) / reviewCount).toFixed(1)
        )
      : null;

  const userReview = reviews.find((review) => review.isCurrentUser) ?? null;

  return {
    reviews,
    summary: {
      reviewCount,
      averageRating,
      ratingBreakdown: buildRatingBreakdown(ratingValues),
    },
    userReview,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseListingId(id);

    if (!listingId) {
      return NextResponse.json({ error: "Invalid listing id." }, { status: 400 });
    }

    const listing = await findListingForReview(listingId);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    const userId = await resolveAuthenticatedUserId();
    const reviewData = await getPostReviews(listingId, userId);

    const isAuthenticated = userId != null;
    const isOwner = isAuthenticated && userId === listing.authorId;
    const hasReviewed = reviewData.userReview != null;

    return NextResponse.json({
      ...reviewData,
      auth: {
        isAuthenticated,
        isOwner,
        hasReviewed,
        canSubmitReview: isAuthenticated && !isOwner && !hasReviewed,
      },
    });
  } catch (error) {
    console.error("[reviews.get] Failed to load reviews", error);
    return NextResponse.json(
      { error: "Unable to load reviews right now." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseListingId(id);

    if (!listingId) {
      return NextResponse.json({ error: "Invalid listing id." }, { status: 400 });
    }

    const reviewerId = await resolveAuthenticatedUserId();
    if (!reviewerId) {
      return NextResponse.json(
        { error: "Please log in to write a review." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => null)) as ReviewRequestBody | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const rating = parseRating(body.rating);
    if (!rating) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5." },
        { status: 400 }
      );
    }

    const comment = normalizeComment(body.comment);
    if (comment && comment.length > 1000) {
      return NextResponse.json(
        { error: "Review comment must be 1000 characters or less." },
        { status: 400 }
      );
    }

    const listing = await findListingForReview(listingId);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    if (listing.authorId === reviewerId) {
      return NextResponse.json(
        { error: "You cannot review your own listing." },
        { status: 400 }
      );
    }

    const existingReview = await prisma.review.findUnique({
      where: {
        postId_reviewerId: {
          postId: listingId,
          reviewerId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingReview) {
      return NextResponse.json(
        { error: "You already reviewed this listing." },
        { status: 409 }
      );
    }

    const createdReview = await prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          postId: listingId,
          reviewerId,
          revieweeId: listing.authorId,
          rating,
          comment,
        },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          reviewerId: true,
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      const revieweeAggregates = await tx.review.aggregate({
        where: {
          revieweeId: listing.authorId,
        },
        _avg: {
          rating: true,
        },
        _count: {
          _all: true,
        },
      });

      const average = decimalToNumber(revieweeAggregates._avg.rating) ?? 0;
      await tx.user.update({
        where: {
          id: listing.authorId,
        },
        data: {
          rating: Number(average.toFixed(2)),
          reviewCount: revieweeAggregates._count._all,
        },
      });

      return review;
    });

    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/my-posts");
    revalidatePath(`/profile/${listing.authorId}`);
    revalidatePath(`/product/${listing.id}`);

    return NextResponse.json({
      review: {
        id: String(createdReview.id),
        rating: Number((decimalToNumber(createdReview.rating) ?? 0).toFixed(1)),
        comment: createdReview.comment,
        createdAt: createdReview.createdAt.toISOString(),
        isCurrentUser: true,
        reviewer: {
          id: String(createdReview.reviewer.id),
          name: formatReviewerName(
            createdReview.reviewer.name,
            createdReview.reviewer.email
          ),
          avatarUrl: resolveProfileAvatarUrl(createdReview.reviewer.avatarUrl),
        },
      },
    });
  } catch (error) {
    const maybeError = error as { code?: unknown };
    if (typeof maybeError.code === "string" && maybeError.code === "P2002") {
      return NextResponse.json(
        { error: "You already reviewed this listing." },
        { status: 409 }
      );
    }

    console.error("[reviews.post] Failed to create review", error);
    return NextResponse.json(
      { error: "Unable to submit review right now." },
      { status: 500 }
    );
  }
}
