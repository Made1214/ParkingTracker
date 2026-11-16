import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  sub: null as string | null,
  // Sesión revocada: el token sigue siendo válido pero Supabase ya no la reconoce.
  revoked: false,
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => ({
        data: mocks.sub ? { claims: { sub: mocks.sub } } : null,
      }),
      getUser: async () => ({
        data: { user: mocks.sub && !mocks.revoked ? { id: mocks.sub } : null },
      }),
    },
  }),
}));
vi.mock("@/shared/lib/env", () => ({
  publicEnv: () => ({ url: "http://db.test", key: "anon", appUrl: "" }),
}));

import { proxy } from "./proxy";
import { RATE_LIMIT, resetMemoryRateLimit } from "@/shared/lib/rate-limit";

const request = (method = "GET", ip = "203.0.113.7", path = "/groups") =>
  new NextRequest(`http://app.test${path}`, {
    method,
    headers: { "x-forwarded-for": ip },
  });

describe("proxy", () => {
  beforeEach(() => {
    resetMemoryRateLimit();
    mocks.sub = "11111111-1111-4111-8111-111111111111";
    mocks.revoked = false;
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

  describe("control de sesión", () => {
    const get = (path: string) => proxy(request("GET", "203.0.113.7", path));

    it("con sesión, /login y /register llevan a los grupos", async () => {
      for (const path of ["/login", "/register"]) {
        const response = await get(path);
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("http://app.test/groups");
      }
    });

    it("con sesión, /login respeta un next interno y descarta uno externo", async () => {
      expect(
        (await get("/login?next=%2Fprofile")).headers.get("location"),
      ).toBe("http://app.test/profile");
      expect(
        (await get("/login?next=%2F%2Fevil.test")).headers.get("location"),
      ).toBe("http://app.test/groups");
    });

    it("con una sesión revocada, /login se muestra en vez de rebotar", async () => {
      mocks.revoked = true;
      expect((await get("/login")).status).toBe(200);
    });

    it("sin sesión, las pantallas privadas llevan al login con next", async () => {
      mocks.sub = null;
      for (const path of ["/groups", "/profile", "/join/ABC123"]) {
        const response = await get(`${path}?tab=plan`);
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
          `http://app.test/login?next=${encodeURIComponent(`${path}?tab=plan`)}`,
        );
      }
    });

    it("sin sesión, las pantallas públicas se sirven", async () => {
      mocks.sub = null;
      for (const path of ["/login", "/register", "/privacy", "/groupsx"])
        expect((await get(path)).status).toBe(200);
    });

    it("sin sesión, /api responde 401 con el formato de error", async () => {
      mocks.sub = null;
      const response = await get(
        "/api/groups/11111111-1111-4111-8111-111111111111/avatar",
      );
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe("UNAUTHENTICATED");
      expect(body.error.request_id).toBe(response.headers.get("X-Request-Id"));
    });

    it("las mutaciones sin sesión no se redirigen (las resuelve la acción)", async () => {
      mocks.sub = null;
      expect((await proxy(request("POST"))).status).toBe(200);
    });
  });
});
