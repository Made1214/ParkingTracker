import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/features/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createGroup, joinGroup } from "./actions";
import { resetMemoryRateLimit } from "@/shared/lib/rate-limit";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(entries)) data.set(k, v);
  return data;
}

describe("groups actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMemoryRateLimit();
    mocks.requireUser.mockResolvedValue({
      supabase: { rpc: mocks.rpc },
      user: { id: "user-1" },
    });
  });

  it("valida nombre, propaga errores de BD y redirige al crear grupo", async () => {
    expect(await createGroup({}, form({ name: "" }))).toMatchObject({
      error: expect.stringContaining("1 y 80"),
    });

    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(await createGroup({}, form({ name: "Playa" }))).toMatchObject({
      error: expect.any(String),
    });

    mocks.rpc.mockResolvedValue({ data: { id: "grp-1" }, error: null });
    await expect(createGroup({}, form({ name: "Playa" }))).rejects.toThrow(
      "REDIRECT:/groups/grp-1",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/groups");
  });

  it("valida formato de código, rate limit, código inexistente y unión exitosa", async () => {
    expect(await joinGroup({}, form({ code: "abc" }))).toMatchObject({
      error: expect.stringContaining("8 caracteres"),
    });

    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0002" } });
    expect(await joinGroup({}, form({ code: "abcd1234" }))).toMatchObject({
      error: "El código de invitación no es válido.",
    });

    mocks.rpc.mockResolvedValue({ data: { id: "grp-2" }, error: null });
    await expect(joinGroup({}, form({ code: "ABCD1234" }))).rejects.toThrow(
      "REDIRECT:/groups/grp-2",
    );

    // Agota el límite de 10 intentos por usuario.
    for (let i = 0; i < 8; i++) {
      await joinGroup({}, form({ code: "ABCD1234" })).catch(() => undefined);
    }
    expect(await joinGroup({}, form({ code: "ABCD1234" }))).toMatchObject({
      error: expect.stringContaining("Demasiados intentos"),
    });
  });
});
