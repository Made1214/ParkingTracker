import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/shared/supabase/server", () => ({ serverClient: vi.fn() }));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
import { getInvitePreview } from "./queries";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ supabase: { rpc: mocks.rpc } });
});

describe("getInvitePreview", () => {
  it("normaliza el código y devuelve el grupo", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          group_id: "g1",
          name: "Los de siempre",
          description: null,
          member_count: 6,
          already_member: false,
        },
      ],
      error: null,
    });
    expect(await getInvitePreview(" dev00001 ")).toEqual({
      code: "DEV00001",
      groupId: "g1",
      name: "Los de siempre",
      description: null,
      memberCount: 6,
      alreadyMember: false,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_invite_preview", {
      p_code: "DEV00001",
    });
  });

  it("pide sesión y vuelve a la invitación después", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    await getInvitePreview("DEV00001");
    expect(mocks.session).toHaveBeenCalledWith("/join/DEV00001");
  });

  it("no consulta con códigos mal formados y devuelve null si no existe", async () => {
    expect(await getInvitePreview("abc")).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await getInvitePreview("NOEXISTE")).toBeNull();
  });

  it("falla si la base de datos falla", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    await expect(getInvitePreview("DEV00001")).rejects.toThrow(
      "No se pudo comprobar la invitación.",
    );
  });
});
