import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ sub: null as string | null }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => ({
        data: mocks.sub ? { claims: { sub: mocks.sub } } : null,
      }),
    },
  }),
}));
vi.mock("@/shared/lib/env", () => ({
  publicEnv: () => ({ url: "http://db.test", key: "anon", appUrl: "" }),
}));

import { proxy } from "./proxy";
import { RATE_LIMIT, resetMemoryRateLimit } from "@/shared/lib/rate-limit";

const request = (method = "GET", ip = "203.0.113.7") =>
  new NextRequest("http://app.test/groups", {
    method,
    headers: { "x-forwarded-for": ip },
  });

describe("proxy", () => {
  beforeEach(() => {
    resetMemoryRateLimit();
    mocks.sub = "11111111-1111-4111-8111-111111111111";
  });

  it("asigna un request_id a cada respuesta y lo reenvía a la app", async () => {
    const response = await proxy(request());
    const id = response.headers.get("X-Request-Id");
    expect(id).toMatch(/^req_[0-9a-f]{12}$/);
    expect(response.headers.get("x-middleware-request-x-request-id")).toBe(id);
  });

  it("no limita las lecturas", async () => {
    for (let i = 0; i <= RATE_LIMIT; i++) await proxy(request());
    expect((await proxy(request())).status).toBe(200);
  });

  it("devuelve 429 con Retry-After después de 60 mutaciones por minuto", async () => {
    for (let i = 0; i < RATE_LIMIT; i++)
      expect((await proxy(request("POST"))).status).toBe(200);
    const blocked = await proxy(request("POST"));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    const body = await blocked.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.request_id).toBe(blocked.headers.get("X-Request-Id"));
  });

  it("sin sesión cuenta por IP", async () => {
    mocks.sub = null;
    for (let i = 0; i < RATE_LIMIT; i++)
      await proxy(request("POST", "1.1.1.1"));
    expect((await proxy(request("POST", "1.1.1.1"))).status).toBe(429);
    expect((await proxy(request("POST", "2.2.2.2"))).status).toBe(200);
  });
});
