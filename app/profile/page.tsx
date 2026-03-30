import type { Metadata } from 'next';
import Link from 'next/link';

import ProfileDashboardClient from '@/components/profile/ProfileDashboardClient';
import { getCurrentUserInfo } from '@/lib/current-user';
import { getMarketplaceListingProductsByUserId } from '@/lib/listings';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'View your account profile and your marketplace listings.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProfilePage() {
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
            <Link href="/home" className="text-sm font-medium text-primary hover:underline">
              Back to marketplace
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const products = currentUser.id
    ? await getMarketplaceListingProductsByUserId(currentUser.id)
    : [];
  const displayName = currentUser.name || currentUser.email.split('@')[0] || 'User';
  const cityLabel = products[0]?.location || 'Location not set';
  const joinedLabel = 'Member on RentHour';

  return (
    <ProfileDashboardClient
      displayName={displayName}
      email={currentUser.email}
      cityLabel={cityLabel}
      joinedLabel={joinedLabel}
      products={products}
    />
  );
}
