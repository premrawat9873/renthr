import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

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
];

const r2Pattern = getR2RemotePattern();
if (r2Pattern) {
  remotePatterns.push(r2Pattern);
}

const nextConfig: NextConfig = {
  images: {
    unoptimized: isDev,
    minimumCacheTTL: 60 * 60 * 24 * 30,
    formats: ["image/avif", "image/webp"],
    remotePatterns,
  },
};

export default nextConfig;
