import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // seller KYC documents are uploaded through Server Actions (4 MB files plus form overhead)
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  devIndicators: false,
  // A stray lockfile in the home directory confuses workspace root detection.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
