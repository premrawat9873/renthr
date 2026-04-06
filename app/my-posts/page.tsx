import type { Metadata } from 'next';
import Link from 'next/link';

import UserListingsGrid from '@/components/marketplace/UserListingsGrid';
import { getCurrentUserInfo } from '@/lib/current-user';
import { getMarketplaceListingProductsByUserId } from '@/lib/listings';

export const metadata: Metadata = {
  title: 'My Posts',
  description: 'View all listings you created in the marketplace.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function MyPostsPage() {
  const currentUser = await getCurrentUserInfo();

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="container py-10 space-y-4">
          <h1 className="font-heading text-2xl font-semibold">My Posts</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to view your posts.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/login?next=/my-posts" className="text-sm font-medium text-primary hover:underline">
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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container py-10 space-y-6">
        <h1 className="font-heading text-2xl font-semibold">My Posts</h1>
        <p className="text-sm text-muted-foreground">
          All listings posted by {currentUser.name || currentUser.email}.
        </p>

        <UserListingsGrid
          products={products}
          emptyTitle="No posts found"
          emptyDescription="You have not created any listing yet."
        />

        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          Back to marketplace
        </Link>
      </div>
    </main>
  );
}
