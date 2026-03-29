import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import UserListingsGrid from '@/components/marketplace/UserListingsGrid';
import {
  getMarketplaceListingProductsByUserId,
  getPublicListingUserProfileById,
} from '@/lib/listings';

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

  const products = await getMarketplaceListingProductsByUserId(profile.id);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container py-10 space-y-6">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold">{profile.name}</h1>
          <p className="text-sm text-muted-foreground">
            Listings posted by this user.
          </p>
        </div>

        <UserListingsGrid
          products={products}
          emptyTitle="No listings yet"
          emptyDescription="This user has not posted any listing yet."
        />

        <div className="flex items-center gap-4">
          <Link href="/home" className="text-sm font-medium text-primary hover:underline">
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
