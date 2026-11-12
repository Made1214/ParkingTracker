import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/shared/lib/env", () => ({
  publicEnv: () => ({ url: "", key: "", appUrl: "https://parking.example" }),
}));
vi.mock("@/shared/supabase/server", () => ({
  serverClient: async () => ({
    auth: { signInWithPassword: mocks.signIn, signUp: mocks.signUp },
  }),
}));
import { login, register } from "./actions";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
};

beforeEach(() => vi.clearAllMocks());

describe("login", () => {
  it("deja entrar con una contraseña anterior a las reglas nuevas", async () => {
    mocks.signIn.mockResolvedValue({ error: null });
    await expect(
      login({}, form({ email: "ana@example.com", password: "devpass8" })),
    ).rejects.toThrow("redirect:");
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "devpass8",
    });
  });

  it("pide correo y contraseña", async () => {
    expect(await login({}, form({ email: "x", password: "" }))).toEqual({
      error: "Escribe un correo válido y tu contraseña.",
    });
  });
});

describe("register", () => {
  const base = { email: "nueva@example.com", name: "Nueva" };

  it("rechaza una contraseña débil sin llamar a Supabase", async () => {
    expect(
      await register({}, form({ ...base, password: "solo-letras" })),
    ).toEqual({ error: "A tu contraseña le falta un número." });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("explica el rechazo por contraseña débil de Supabase", async () => {
    mocks.signUp.mockResolvedValue({
      data: {},
      error: { code: "weak_password" },
    });
    expect(
      await register({}, form({ ...base, password: "planazo2026" })),
    ).toEqual({
      error:
        "Esa contraseña no es segura. Usa 10 o más caracteres, con letras y números.",
    });
  });

  it("crea la cuenta con una contraseña válida", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    expect(
      await register({}, form({ ...base, password: "planazo2026" })),
    ).toEqual({
      success: "Revisa tu correo para confirmar tu cuenta y continuar.",
    });
  });
});
