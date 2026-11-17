import type { NextConfig } from "next";
import { publicEnv } from "./src/shared/lib/env";

const { url } = publicEnv();
const supabaseUrl = new URL(url);
const supabaseOrigin = supabaseUrl.origin;
const supabaseWsOrigin = `${supabaseUrl.protocol === "https:" ? "wss:" : "ws:"}//${supabaseUrl.host}`;
const isDev = process.env.NODE_ENV === "development";
// Sentry (opcional): el navegador envía los errores al host del DSN.
// Un DSN mal escrito no debe tumbar el build: se ignora en la CSP.
function sentryCspOrigin(dsn?: string) {
  if (!dsn?.trim()) return "";
  try {
    const { protocol, origin } = new URL(dsn.trim());
    return protocol === "https:" ? ` ${origin}` : "";
  } catch {
    return "";
  }
}
const sentryOrigin = sentryCspOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN);
// Lector de facturas (Tesseract.js): el motor y el modelo de idioma se
// descargan de jsDelivr y corren en un worker. La foto no sale del navegador.
const ocrAssets = "https://cdn.jsdelivr.net";
// En desarrollo, Vercel Analytics carga su script de depuración desde aquí.
const vercelScripts = isDev ? " https://va.vercel-scripts.com" : "";

const cspReportOnly = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${ocrAssets}${isDev ? " 'unsafe-eval'" : ""}${vercelScripts}`,
  `worker-src 'self' blob: ${ocrAssets}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: https://res.cloudinary.com https://lh3.googleusercontent.com ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWsOrigin} https://api.cloudinary.com https://res.cloudinary.com ${ocrAssets}${sentryOrigin}`,
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
