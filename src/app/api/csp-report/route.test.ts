import { beforeEach, describe, expect, it, vi } from "vitest";

const logMock = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/logger", () => ({ log: logMock }));

import { POST } from "./route";
import { resetMemoryRateLimit } from "@/shared/lib/rate-limit";

function makeRequest(
  body: string,
  contentType = "application/csp-report",
  ip = "203.0.113.42",
) {
  return new Request("http://localhost:3000/api/csp-report", {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "x-forwarded-for": ip,
    },
    body,
  });
}

describe("POST /api/csp-report", () => {
  beforeEach(() => {
    logMock.mockReset();
    resetMemoryRateLimit();
  });

  it("rechaza tipos de contenido distintos a reportes CSP", async () => {
    const response = await POST(makeRequest("{}", "application/json"));
    expect(response.status).toBe(415);
  });

  it("registra reportes legacy (report-uri) con la directiva efectiva", async () => {
    const response = await POST(
      makeRequest(
        JSON.stringify({
          "csp-report": { "effective-directive": "script-src" },
        }),
      ),
    );
    expect(response.status).toBe(204);
    expect(logMock).toHaveBeenCalledWith("warn", "csp_violation", {
      directive: "script-src",
    });
  });

  it("registra lotes modernos (Reporting API) deduplicando directivas", async () => {
    const response = await POST(
      makeRequest(
        JSON.stringify([
          { type: "csp-violation", body: { effectiveDirective: "img-src" } },
          { type: "csp-violation", body: { effectiveDirective: "img-src" } },
          {
            type: "csp-violation",
            body: { effectiveDirective: "connect-src" },
          },
        ]),
        "application/reports+json",
      ),
    );
    expect(response.status).toBe(204);
    expect(logMock).toHaveBeenCalledWith("warn", "csp_violation", {
      directives: ["img-src", "connect-src"],
    });
  });

  it("devuelve 413 si el reporte excede 16 KB", async () => {
    const response = await POST(makeRequest("x".repeat(17_000)));
    expect(response.status).toBe(413);
  });

  it("devuelve 400 si el JSON está mal formado", async () => {
    const response = await POST(makeRequest("{not-json"));
    expect(response.status).toBe(400);
  });
});
