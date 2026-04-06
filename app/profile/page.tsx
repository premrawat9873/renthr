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
  title: 'Profile',
  description: 'View your account profile and your marketplace listings.',
  robots: {
    index: false,
    follow: false,
  },
};

type ProfilePageSearchParams = {
  openPost?: string;
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<ProfilePageSearchParams>;
}) {
  const params = await searchParams;
  const shouldOpenPostFlow =
    params.openPost === '1' ||
    params.openPost === 'true' ||
    params.openPost === 'yes';
  const currentUser = await getCurrentUserInfo();

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="container py-10 space-y-4">
          <h1 className="font-heading text-2xl font-semibold">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Please sign in to view your profile and listings.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/login?next=/profile" className="text-sm font-medium text-primary hover:underline">
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
      displayName={displayName}
      email={currentUser.email}
      avatarUrl={resolveProfileAvatarUrl(currentUser.avatarUrl)}
      cityLabel={cityLabel}
      joinedLabel={joinedLabel}
      products={products}
      wishlistProducts={wishlistProducts}
      initialPostFlowOpen={shouldOpenPostFlow}
    />
  );
}
