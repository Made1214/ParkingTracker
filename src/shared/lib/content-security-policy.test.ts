import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  publicEnv: () => ({
    url: "https://demo.supabase.co",
    key: "anon",
    appUrl: "https://app.example.com",
  }),
}));

import {
  contentSecurityPolicy,
  securityReportingEndpoint,
} from "./content-security-policy";

describe("contentSecurityPolicy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("permite el origen de Tesseract.js en jsDelivr y el reporte CSP", () => {
    const policy = contentSecurityPolicy();
    expect(policy).toContain(
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
    );
    expect(policy).toContain(
      "worker-src 'self' blob: https://cdn.jsdelivr.net",
    );
    expect(policy).toContain(
      "connect-src 'self' https://demo.supabase.co wss://demo.supabase.co https://cdn.jsdelivr.net",
    );
    expect(policy).toContain("report-uri /api/csp-report");
    expect(policy).toContain("report-to parking-tracker-csp");
  });

  it("usa nonce por petición cuando se solicita modo estricto", () => {
    const policy = contentSecurityPolicy("abc123");
    expect(policy).toContain(
      "script-src 'self' 'nonce-abc123' 'wasm-unsafe-eval'",
    );
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it("incluye el origen de Sentry solo cuando el DSN es HTTPS válido", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://pub@o1.ingest.sentry.io/1");
    expect(contentSecurityPolicy()).toContain("https://o1.ingest.sentry.io");

    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "not-a-url");
    expect(contentSecurityPolicy()).not.toContain("sentry.io");
  });

  it("construye el header Reporting-Endpoints con el origen recibido", () => {
    expect(securityReportingEndpoint("https://app.example.com")).toBe(
      'parking-tracker-csp="https://app.example.com/api/csp-report"',
    );
  });
});
