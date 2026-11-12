import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/shared/supabase/server", () => ({
  serverClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
import { requireUser } from "./session";

beforeEach(() => vi.clearAllMocks());

describe("requireUser", () => {
  it("devuelve el cliente y la persona con sesión", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { user } = await requireUser();
    expect(user).toEqual({ id: "u1" });
  });

  it("sin sesión manda al login y recuerda a dónde volver", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireUser("/groups/a?b=1")).rejects.toThrow(
      "redirect:/login?next=%2Fgroups%2Fa%3Fb%3D1",
    );
  });
});
