import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every dashboard page is per-user and live, so we render dynamically.
  cacheComponents: false,
  partialPrefetching: false,
  serverExternalPackages: ["pg", "pdfkit", "exceljs"],
  // Arabic font files read at runtime by the quote PDF generator
  outputFileTracingIncludes: {
    "/**": ["./assets/fonts/**/*"],
  },
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
