import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  abortSignal: vi.fn(),
}));

vi.mock("@/shared/supabase/server", () => ({
  serverClient: async () => ({
    rpc: mocks.rpc,
  }),
}));

import { dynamic, GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    mocks.rpc.mockReturnValue({ abortSignal: mocks.abortSignal });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("forces dynamic rendering", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns 200 with ok status and no-store cache header when unauthenticated ping succeeds", async () => {
    mocks.abortSignal.mockResolvedValue({ data: true, error: null });

    const response = await GET(new Request("http://localhost:3000/api/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("database_healthcheck");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      status: "ok",
      db: "ok",
      time: expect.any(String),
    });
  });

  it("returns 503 with db: error when Supabase reports an unexpected error", async () => {
    mocks.abortSignal.mockResolvedValue({
      data: null,
      error: { code: "PGRST000" },
    });

    const response = await GET(new Request("http://localhost:3000/api/health"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      status: "error",
      db: "error",
      time: expect.any(String),
    });
  });

  it("returns 503 when the probe throws", async () => {
    mocks.abortSignal.mockRejectedValue(new Error("network down"));

    const response = await GET(new Request("http://localhost:3000/api/health"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.db).toBe("error");
  });

  it("requires Bearer token when HEALTH_CHECK_SECRET is configured", async () => {
    vi.stubEnv("HEALTH_CHECK_SECRET", "top-secret");
    mocks.abortSignal.mockResolvedValue({ data: true, error: null });

    const missing = await GET(new Request("http://localhost:3000/api/health"));
    expect(missing.status).toBe(401);

    const wrong = await GET(
      new Request("http://localhost:3000/api/health", {
        headers: { Authorization: "Bearer wrong" },
      }),
    );
    expect(wrong.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();

    const valid = await GET(
      new Request("http://localhost:3000/api/health", {
        headers: { Authorization: "Bearer top-secret" },
      }),
    );
    expect(valid.status).toBe(200);
  });

  it("accepts CRON_SECRET when HEALTH_CHECK_SECRET is not set", async () => {
    vi.stubEnv("CRON_SECRET", "vercel-cron-secret");
    mocks.abortSignal.mockResolvedValue({ data: true, error: null });

    const unauthorized = await GET(
      new Request("http://localhost:3000/api/health"),
    );
    expect(unauthorized.status).toBe(401);

    const authorized = await GET(
      new Request("http://localhost:3000/api/health", {
        headers: { Authorization: "Bearer vercel-cron-secret" },
      }),
    );
    expect(authorized.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
});
