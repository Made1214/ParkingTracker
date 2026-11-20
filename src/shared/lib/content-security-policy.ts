import { publicEnv } from "./env";

/** Construye la política con los orígenes usados en este entorno. */
export function contentSecurityPolicy(nonce?: string) {
  const supabase = new URL(publicEnv().url);
  const ws = `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`;
  const dev = process.env.NODE_ENV === "development";
  const ocr = "https://cdn.jsdelivr.net";
  let sentry = "";
  try {
    const dsn = new URL(process.env.NEXT_PUBLIC_SENTRY_DSN ?? "");
    if (dsn.protocol === "https:") sentry = ` ${dsn.origin}`;
  } catch {
    // La telemetría externa es opcional.
  }
  return [
    "default-src 'self'",
    `script-src 'self' ${nonce ? `'nonce-${nonce}'` : "'unsafe-inline'"} 'wasm-unsafe-eval' ${ocr}${dev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ""}`,
    `worker-src 'self' blob: ${ocr}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: https://res.cloudinary.com https://lh3.googleusercontent.com ${supabase.origin}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase.origin} ${ws} ${ocr}${sentry}${dev ? " https://va.vercel-scripts.com" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${supabase.origin} https://accounts.google.com`,
    "frame-ancestors 'none'",
    "report-uri /api/csp-report",
    "report-to parking-tracker-csp",
  ].join("; ");
}

/** Señala al navegador el receptor de avisos CSP del mismo entorno. */
export function securityReportingEndpoint(origin: string) {
  return `parking-tracker-csp="${new URL("/api/csp-report", origin).href}"`;
}
