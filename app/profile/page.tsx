import type { Metadata } from 'next';
import Link from 'next/link';

import UserListingsGrid from '@/components/marketplace/UserListingsGrid';
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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container py-10 space-y-6">
        <h1 className="font-heading text-2xl font-semibold">Profile</h1>

        <section className="rounded-2xl border border-border/50 bg-card p-5 sm:p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Account</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{displayName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{currentUser.email}</p>
          {currentUser.id && (
            <Link href={`/profile/${currentUser.id}`} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              View public profile
            </Link>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-xl font-semibold">My Posts</h2>
            <Link href="/my-posts" className="text-sm font-medium text-primary hover:underline">
              Open My Posts page
            </Link>
          </div>

          <UserListingsGrid
            products={products}
            emptyTitle="No listings yet"
            emptyDescription="Create your first listing from the Post Listing button on the home page."
          />
        </section>

        <div>
          <Link href="/home" className="text-sm font-medium text-primary hover:underline">
            Back to marketplace
          </Link>
        </div>
      </div>
    </main>
  );
}
