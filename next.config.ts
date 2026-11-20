import type { NextConfig } from "next";
import { publicEnv } from "./src/shared/lib/env";

import { withSentryConfig } from "@sentry/nextjs/config";
import {
  contentSecurityPolicy,
  securityReportingEndpoint,
} from "./src/shared/lib/content-security-policy";

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
  {
    key: "Reporting-Endpoints",
    value: securityReportingEndpoint(publicEnv().appUrl),
  },
  ...(process.env.CSP_MODE === "enforce"
    ? []
    : [
        {
          key: "Content-Security-Policy-Report-Only",
          value: contentSecurityPolicy(),
        },
      ]),
];

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: { position: "bottom-right" },
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
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
const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = process.env;
export default SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT
  ? withSentryConfig(config, {
      authToken: SENTRY_AUTH_TOKEN,
      org: SENTRY_ORG,
      project: SENTRY_PROJECT,
      silent: true,
      telemetry: false,
    })
  : config;
