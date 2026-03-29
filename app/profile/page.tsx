import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'View and update your account profile.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container py-10 space-y-4">
        <h1 className="font-heading text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your profile dashboard will appear here.
        </p>
        <Link href="/home" className="text-sm font-medium text-primary hover:underline">
          Back to marketplace
        </Link>
      </div>
    </main>
  );
}
