import type { NextConfig } from "next";
import { publicEnv } from "./src/shared/lib/env";

publicEnv();
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
    ];
  },
};
export default config;
