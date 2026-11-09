import type { NextConfig } from "next";
import { publicEnv } from "./src/shared/lib/env";

publicEnv();
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: { position: "bottom-right" },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};
export default config;
