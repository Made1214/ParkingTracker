import type { NextConfig } from "next";
import { publicEnv } from "./src/shared/lib/env";

publicEnv();
const config: NextConfig = { poweredByHeader: false };
export default config;
