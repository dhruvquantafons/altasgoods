import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  // A stray lockfile in the home directory confuses workspace root detection.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
