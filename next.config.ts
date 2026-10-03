import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Exercise photos from free-exercise-db (public domain).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/yuhonas/free-exercise-db/**",
      },
    ],
  },
};

export default nextConfig;
