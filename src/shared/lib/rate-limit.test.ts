import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RATE_LIMIT,
  hitRateLimit,
  isMutation,
  memoryHit,
  memoryPeek,
  peekRateLimit,
  resetMemoryRateLimit,
} from "./rate-limit";

describe("límite con tope propio", () => {
  beforeEach(() => resetMemoryRateLimit());

  it("bloquea al pasar el tope dado, no el general", async () => {
    const options = { scope: "x", limit: 3 };
    for (let i = 0; i < 3; i++)
      expect((await hitRateLimit("a", options)).allowed).toBe(true);
    expect((await hitRateLimit("a", options)).allowed).toBe(false);
  });

  it("mirar no suma intentos y los ámbitos van aparte", async () => {
    const options = { scope: "x", limit: 2 };
    for (let i = 0; i < 5; i++) await peekRateLimit("a", options);
    expect((await peekRateLimit("a", options)).remaining).toBe(2);
    await hitRateLimit("a", options);
    await hitRateLimit("a", options);
    expect((await peekRateLimit("a", options)).allowed).toBe(false);
    expect((await peekRateLimit("a", { scope: "y", limit: 2 })).allowed).toBe(
      true,
    );
  });

  it("la lectura en memoria reinicia al pasar la ventana", () => {
    memoryHit("k", 0, 1);
    expect(memoryPeek("k", 1_000, 1).allowed).toBe(false);
    expect(memoryPeek("k", 61_000, 1).allowed).toBe(true);
  });
});

describe("límite de peticiones en memoria", () => {
  beforeEach(() => resetMemoryRateLimit());

  it("permite 60 mutaciones por minuto y bloquea la 61", () => {
    const now = 1_000_000;
    for (let i = 1; i <= RATE_LIMIT; i++) {
      const result = memoryHit("user:a", now);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RATE_LIMIT - i);
    }
    const blocked = memoryHit("user:a", now + 30_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(30);
  });

  it("cuenta cada usuario por separado", () => {
    for (let i = 0; i <= RATE_LIMIT; i++) memoryHit("user:a", 0);
    expect(memoryHit("user:b", 0).allowed).toBe(true);
  });

  it("reinicia la ventana pasado un minuto", () => {
    for (let i = 0; i <= RATE_LIMIT; i++) memoryHit("user:a", 0);
    expect(memoryHit("user:a", 60_000).allowed).toBe(true);
  });
});

describe("límite de peticiones con Upstash", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com/");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchMock.mockReset();
  });

  it("usa el contador compartido", async () => {
    fetchMock.mockResolvedValue(
      Response.json([{ result: 61 }, { result: 0 }, { result: 42 }]),
    );
    const result = await hitRateLimit("user:a");
    expect(result).toEqual({ allowed: false, remaining: 0, retryAfter: 42 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://redis.example.com/pipeline");
    expect(init.headers.Authorization).toBe("Bearer token");
    expect(JSON.parse(init.body)[0]).toEqual(["INCR", "rl:mut:user:a"]);
  });

  it("deja pasar si Upstash falla", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect((await hitRateLimit("user:a")).allowed).toBe(true);
  });
});

it("solo cuenta como mutación lo que no es lectura", () => {
  expect(isMutation("POST")).toBe(true);
  expect(isMutation("delete")).toBe(true);
  expect(isMutation("GET")).toBe(false);
  expect(isMutation("HEAD")).toBe(false);
});
