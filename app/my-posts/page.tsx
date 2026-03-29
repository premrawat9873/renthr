import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'My Posts',
  description: 'Manage the listings you created in the marketplace.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MyPostsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container py-10 space-y-4">
        <h1 className="font-heading text-2xl font-semibold">My Posts</h1>
        <p className="text-sm text-muted-foreground">
          This is where your posted listings will be shown.
        </p>
        <Link href="/home" className="text-sm font-medium text-primary hover:underline">
          Back to marketplace
        </Link>
      </div>
    </main>
  );
}
