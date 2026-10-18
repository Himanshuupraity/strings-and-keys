import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is almost entirely interactive client UI with local-first data, so Cache Components /
  // Partial Prefetching add constraints (e.g. no `new Date()` during prerender) without benefit.
  turbopack: {
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
