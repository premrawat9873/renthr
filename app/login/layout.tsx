import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to manage your listings and account settings.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
