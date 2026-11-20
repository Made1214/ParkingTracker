import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  ip: "198.51.100.10",
}));

vi.mock("@/shared/supabase/server", () => ({ serverClient: mocks.client }));
vi.mock("@/shared/lib/env", () => ({
  publicEnv: () => ({ appUrl: "https://parking.example" }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": mocks.ip }),
}));

import { googleLogin, login, logout, register } from "./actions";
import { resetMemoryRateLimit } from "@/shared/lib/rate-limit";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(entries)) data.set(k, v);
  return data;
}

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMemoryRateLimit();
    mocks.ip = "198.51.100.10";
    mocks.client.mockResolvedValue({
      auth: {
        signInWithPassword: mocks.signInWithPassword,
        signUp: mocks.signUp,
        signInWithOAuth: mocks.signInWithOAuth,
        signOut: mocks.signOut,
      },
    });
  });

  it("valida credenciales, limita intentos fallidos y redirige con safeNext", async () => {
    expect(await login({}, form({ email: "mal", password: "" }))).toMatchObject(
      { error: expect.stringContaining("correo válido") },
    );

    mocks.signInWithPassword.mockResolvedValue({
      error: { message: "invalid" },
    });
    for (let i = 0; i < 5; i++) {
      const res = await login(
        {},
        form({ email: "ana@example.com", password: "wrong" }),
      );
      expect(res.error).toContain("No pudimos iniciar sesión");
    }
    const blocked = await login(
      {},
      form({ email: "ana@example.com", password: "wrong" }),
    );
    expect(blocked.error).toContain("Demasiados");
    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(5);

    resetMemoryRateLimit();
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    await expect(
      login(
        {},
        form({
          email: "ana@example.com",
          password: "Password123",
          next: "/profile",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/profile");
  });

  it("valida nombre, contraseña, rate limit y respuestas en register", async () => {
    expect(
      await register(
        {},
        form({ name: "", email: "ana@example.com", password: "Password123" }),
      ),
    ).toMatchObject({ error: expect.stringContaining("Revisa tu nombre") });

    expect(
      await register(
        {},
        form({ name: "Ana", email: "ana@example.com", password: "short" }),
      ),
    ).toMatchObject({ error: expect.stringContaining("10") });

    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: { code: "weak_password" },
    });
    expect(
      await register(
        {},
        form({
          name: "Ana",
          email: "ana@example.com",
          password: "Password123",
        }),
      ),
    ).toMatchObject({ error: expect.stringContaining("no es segura") });

    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: { message: "boom" },
    });
    expect(
      await register(
        {},
        form({
          name: "Ana",
          email: "ana@example.com",
          password: "Password123",
        }),
      ),
    ).toMatchObject({ error: expect.stringContaining("No pudimos crear") });

    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    expect(
      await register(
        {},
        form({
          name: "Ana",
          email: "ana@example.com",
          password: "Password123",
        }),
      ),
    ).toMatchObject({ success: expect.stringContaining("Revisa tu correo") });

    mocks.signUp.mockResolvedValue({
      data: { session: { access_token: "tok" } },
      error: null,
    });
    await expect(
      register(
        {},
        form({
          name: "Ana",
          email: "ana@example.com",
          password: "Password123",
          next: "/groups",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/groups");

    // Agota el límite de 10 registros por IP.
    for (let i = 0; i < 6; i++) {
      await register(
        {},
        form({
          name: "Ana",
          email: `u${i}@example.com`,
          password: "Password123",
        }),
      ).catch(() => undefined);
    }
    expect(
      await register(
        {},
        form({
          name: "Ana",
          email: "extra@example.com",
          password: "Password123",
        }),
      ),
    ).toMatchObject({ error: expect.stringContaining("Demasiados registros") });
  });

  it("maneja OAuth con Google y cierre de sesión", async () => {
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: "off" },
    });
    expect(await googleLogin({}, form({}))).toMatchObject({
      error: expect.stringContaining("Google no está disponible"),
    });

    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/auth" },
      error: null,
    });
    await expect(googleLogin({}, form({ next: "/profile" }))).rejects.toThrow(
      "REDIRECT:https://accounts.google.com/auth",
    );

    mocks.signOut.mockResolvedValue({ error: { message: "fail" } });
    await expect(logout()).rejects.toThrow("No se pudo cerrar la sesión");

    mocks.signOut.mockResolvedValue({ error: null });
    await expect(logout()).rejects.toThrow("REDIRECT:/login");
  });
});
