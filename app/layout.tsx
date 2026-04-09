import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/providers";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next";
import AdSenseInlineAd from "@/components/ui/AdSenseInlineAd";

const siteUrl = getSiteUrl();
const FAVICON_VERSION = "20260408";
const FAVICON_48_URL = `/favicon-48.png?v=${FAVICON_VERSION}`;
const FAVICON_192_URL = `/favicon-192.png?v=${FAVICON_VERSION}`;
const APPLE_TOUCH_ICON_URL = `/apple-touch-icon.png?v=${FAVICON_VERSION}`;
const SHORTCUT_ICON_URL = `/favicon.ico?v=${FAVICON_VERSION}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: [
      { url: FAVICON_48_URL, type: "image/png", sizes: "48x48" },
      { url: FAVICON_192_URL, type: "image/png", sizes: "192x192" },
    ],
    shortcut: [{ url: SHORTCUT_ICON_URL, type: "image/x-icon" }],
    apple: [
      { url: APPLE_TOUCH_ICON_URL, type: "image/png", sizes: "180x180" },
    ],
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <meta
          name="google-adsense-account"
          content="ca-pub-9411649869227225"
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9411649869227225"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <div className="w-full px-4 pb-6">
          <div className="mx-auto w-full max-w-6xl">
            <AdSenseInlineAd adSlot="2120281974" />
          </div>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
