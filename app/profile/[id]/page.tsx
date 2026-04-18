import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, CheckCircle2, Package, Star } from 'lucide-react';

import UserListingsGrid from '@/components/marketplace/UserListingsGrid';
import ReportActionButton from '@/components/marketplace/ReportActionButton';
import AdminUserActions from '@/components/marketplace/AdminUserActions';
import { Button } from '@/components/ui/button';
import { formatTimeAgo } from '@/data/marketplaceData';
import {
  getMarketplaceListingProductsByUserId,
  getPublicListingUserProfileById,
  getPublicUserReviewHighlightsByUserId,
} from '@/lib/listings';
import { getCurrentUserInfo } from '@/lib/current-user';
import { isCurrentUserAdmin } from '@/lib/admin';
import { getProductHref } from '@/lib/product-url';

type ProfilePageParams = {
  id: string;
};

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<ProfilePageParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPublicListingUserProfileById(id);

  if (!profile) {
    return {
      title: 'Profile Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: `${profile.name}'s Listings`,
    description: `Browse listings posted by ${profile.name}.`,
    alternates: {
      canonical: `/profile/${profile.id}`,
    },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<ProfilePageParams>;
}) {
  const { id } = await params;

  const profile = await getPublicListingUserProfileById(id);
  if (!profile) {
    notFound();
  }

  const currentUser = await getCurrentUserInfo();
  const showAdminControls = currentUser ? await isCurrentUserAdmin() : false;

  const [products, recentReviews] = await Promise.all([
    getMarketplaceListingProductsByUserId(profile.id),
    getPublicUserReviewHighlightsByUserId(profile.id, { limit: 6 }),
  ]);
  const totalListings = products.length;
  const listingReviewCount = products.reduce(
    (sum, product) => sum + (product.reviewCount ?? 0),
    0
  );
  const listingRatingValues = products
    .map((product) => product.rating)
    .filter((rating): rating is number => typeof rating === 'number');
  const averageRatingFromListings =
    listingRatingValues.length > 0
      ? Number(
          (
            listingRatingValues.reduce((sum, rating) => sum + rating, 0) /
            listingRatingValues.length
          ).toFixed(1)
        )
      : 0;
  const averageRating = profile.rating > 0 ? profile.rating : averageRatingFromListings;
  const totalReviews = profile.reviewCount > 0 ? profile.reviewCount : listingReviewCount;
  const joinedLabel = new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
  }).format(profile.joinedAt);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/75 shadow-[0_6px_16px_-14px_hsl(var(--foreground)/0.35)] backdrop-blur-md">
        <div className="mx-auto flex h-[62px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-ml-2 text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-foreground"
            >
              <Link href="/">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            </Button>

            <Link href="/" className="flex items-center gap-1">
              <span className="text-xl font-semibold tracking-tight text-foreground">rent</span>
              <span className="rounded-md bg-accent px-2 py-0.5 text-xl font-bold text-accent-foreground">
                hour
              </span>
            </Link>
          </div>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-foreground"
          >
            <Link href="/profile">My Profile</Link>
          </Button>
        </div>
      </header>

      <div className="container py-10 space-y-8">
        <section className="rounded-[1.35rem] border border-border/55 bg-card p-5 shadow-[0_8px_18px_-16px_hsl(var(--foreground)/0.45)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="relative h-[88px] w-[88px] overflow-hidden rounded-2xl border border-border/50 bg-muted">
                <Image
                  src={profile.avatarUrl}
                  alt={`${profile.name} profile photo`}
                  fill
                  sizes="88px"
                  className="object-cover"
                />
              </div>

              <div className="space-y-3 text-center sm:text-left">
                <div>
                  <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-foreground">
                    {profile.name}
                  </h1>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Verified Seller</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 text-muted-foreground sm:flex-row sm:gap-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Member since {joinedLabel}</span>
                  </div>

                  <ReportActionButton
                    targetType="user"
                    targetId={profile.id}
                    title="Report user"
                    buttonLabel="Report User"
                    variant="outline"
                  />
                  {showAdminControls ? (
                    // Admin-only actions (client component)
                    <div className="ml-2">
                      {/* AdminUserActions is a client component */}
                      {/* @ts-ignore-next-line */}
                      <AdminUserActions userId={profile.id} />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 lg:ml-auto lg:justify-end">
              <div className="group flex h-[7.25rem] w-[7.25rem] cursor-default flex-col items-center justify-center rounded-2xl border border-border/50 bg-accent/30 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/60 hover:shadow-md">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <span className="text-2xl font-bold text-foreground">{totalListings}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">Total Listings</span>
              </div>

              <div className="group flex h-[7.25rem] w-[7.25rem] cursor-default flex-col items-center justify-center rounded-2xl border border-border/50 bg-accent/30 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/60 hover:shadow-md">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                  <Star className="h-5 w-5 fill-current text-primary" />
                </div>
                <span className="text-2xl font-bold text-foreground">
                  {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">Seller Rating</span>
              </div>

              <div className="group flex h-[7.25rem] w-[7.25rem] cursor-default flex-col items-center justify-center rounded-2xl border border-border/50 bg-accent/30 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/60 hover:shadow-md">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                <span className="text-2xl font-bold text-foreground">{totalReviews}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">Total Reviews</span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="font-heading text-xl font-semibold">Posts</h2>
            <p className="text-sm text-muted-foreground">Listings posted by this user.</p>
          </div>

          <UserListingsGrid
            products={products}
            emptyTitle="No listings yet"
            emptyDescription="This user has not posted any listing yet."
          />
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="font-heading text-xl font-semibold">Recent Ratings</h2>
            <p className="text-sm text-muted-foreground">
              What renters are saying about this seller.
            </p>
          </div>

          {recentReviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-primary/35 bg-card px-6 py-10 text-center">
              <h3 className="font-heading text-xl font-semibold">No ratings yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Ratings and written reviews will appear here once renters leave feedback.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {recentReviews.map((review) => (
                <article
                  key={review.id}
                  className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border/50 bg-muted">
                        <Image
                          src={review.reviewer.avatarUrl}
                          alt={`${review.reviewer.name} avatar`}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {review.reviewer.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatTimeAgo(review.createdAt)}</p>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {review.rating.toFixed(1)}
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {review.comment || 'No written comment provided.'}
                  </p>

                  <Link
                    href={getProductHref(review.post)}
                    className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
                  >
                    On listing: {review.post.title}
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            Back to marketplace
          </Link>
          <Link href="/profile" className="text-sm font-medium text-primary hover:underline">
            Go to my profile
          </Link>
        </div>
      </div>
    </main>
  );
}
