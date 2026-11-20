import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // product images and return photos are uploaded through Server Actions (4 MB files plus form overhead)
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // only bundled sample photos and uploaded product images, never with a query string
  images: {
    // On Vercel (services mode) the /_next/image optimizer answers 404, so images are served as-is there.
    unoptimized: !!process.env.VERCEL,
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/media/**", search: "" },
    ],
  },
  devIndicators: false,
  // A stray lockfile in the home directory confuses workspace root detection.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
