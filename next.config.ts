import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every dashboard page is per-user and live, so we render dynamically.
  cacheComponents: false,
  partialPrefetching: false,
  serverExternalPackages: ["pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
