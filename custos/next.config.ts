import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for catching common issues
  reactStrictMode: true,

  // Optimize production builds
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  // Optimize images
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },

  // Security headers for production
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },

  // Reduce build output noise
  logging: {
    fetches: {
      fullUrl: false,
    },
  },

  // Exclude test/script files from being compiled by Next.js
  typescript: {
    // We exclude tests from build (they have TS errors and aren't needed for Next.js)
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
