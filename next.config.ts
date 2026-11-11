import type { NextConfig } from "next";
import { publicEnv } from "./src/shared/lib/env";

const { url } = publicEnv();
const supabaseUrl = new URL(url);
const supabaseOrigin = supabaseUrl.origin;
const supabaseWsOrigin = `${supabaseUrl.protocol === "https:" ? "wss:" : "ws:"}//${supabaseUrl.host}`;
const isDev = process.env.NODE_ENV === "development";

const cspReportOnly = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: https://res.cloudinary.com https://lh3.googleusercontent.com ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWsOrigin} https://api.cloudinary.com https://res.cloudinary.com`,
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${supabaseOrigin} https://accounts.google.com`,
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: { position: "bottom-right" },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [
      {
        // El navegador debe ver siempre la última versión del service worker.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};
export default config;
