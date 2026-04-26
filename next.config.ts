import type { NextConfig } from "next";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function getR2RemotePattern() {
  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  if (!r2PublicUrl) {
    return null;
  }

  try {
    const url = new URL(r2PublicUrl);
    const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");

    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      pathname: `${pathname}/**`,
    };
  } catch {
    return null;
  }
}

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  {
    protocol: "https",
    hostname: "images.unsplash.com",
  },
  {
    protocol: "https",
    hostname: "lh3.googleusercontent.com",
  },
  {
    protocol: "https",
    hostname: "pub-cfd7a093c0904912849f7177f850e62f.r2.dev",
  },
  {
    protocol: "https",
    hostname: "**.r2.dev",
  },
];

const r2Pattern = getR2RemotePattern();
if (r2Pattern) {
  remotePatterns.push(r2Pattern);
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
    ];
  },
  images: {
    // Keep image optimization enabled in all environments so repeated renders
    // hit Next's cache instead of directly hammering the R2 origin.
    unoptimized: false,
    minimumCacheTTL: ONE_YEAR_SECONDS,
    deviceSizes: [360, 640, 768, 1024, 1280, 1536],
    imageSizes: [96, 160, 240, 320, 480],
    formats: ["image/avif", "image/webp"],
    qualities: [70, 75],
    remotePatterns,
  },
};

export default nextConfig;
