import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Locale routing lives in src/middleware.ts + the [locale] App Router segment.
  // Do not set `i18n` here (Pages Router only).
  // Do not set `output: 'export'` — the app uses middleware, cookies, and server actions.
};

export default nextConfig;
