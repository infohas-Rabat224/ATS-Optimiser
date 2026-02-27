import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Exclude packages that have issues with bundling
  serverExternalPackages: ['pdfjs-dist'],
};

export default nextConfig;
