import type { Metadata } from 'next';
import Link from 'next/link';

import ProfileDashboardClient from '@/components/profile/ProfileDashboardClient';
import { getCurrentUserInfo } from '@/lib/current-user';
import {
  getMarketplaceListingProductsByUserId,
  getWishlistProductsByUserId,
} from '@/lib/listings';
import { resolveProfileAvatarUrl } from '@/lib/profile-avatar';

export const metadata: Metadata = {
  title: 'Wishlist',
  description: 'View and manage the listings you have saved.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function WishlistPage() {
  const currentUser = await getCurrentUserInfo();

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="container space-y-4 py-10">
          <h1 className="font-heading text-2xl font-semibold">Wishlist</h1>
          <p className="text-sm text-muted-foreground">
            Please sign in to view your saved listings.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/login?next=/wishlist" className="text-sm font-medium text-primary hover:underline">
              Go to login
            </Link>
            <Link href="/" className="text-sm font-medium text-primary hover:underline">
              Back to marketplace
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const products = currentUser.id
    ? await getMarketplaceListingProductsByUserId(currentUser.id, {
        includeInactive: true,
      })
    : [];
  const wishlistProducts = currentUser.id
    ? await getWishlistProductsByUserId(currentUser.id)
    : [];
  const displayName = currentUser.name || currentUser.email.split('@')[0] || 'User';
  const cityLabel = products[0]?.location || 'Location not set';
  const joinedLabel = 'Member on RentHour';

  return (
    <ProfileDashboardClient
      profileId={currentUser.id}
      displayName={displayName}
      username={currentUser.username ?? null}
      email={currentUser.email}
      avatarUrl={resolveProfileAvatarUrl(currentUser.avatarUrl)}
      isVerified={currentUser.isVerified}
      cityLabel={cityLabel}
      joinedLabel={joinedLabel}
      products={products}
      wishlistProducts={wishlistProducts}
      initialTab="wishlist"
    />
  );
}
