import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  mediaConfigured: vi.fn(),
  uploadPrivateImage: vi.fn(),
  deletePrivateImage: vi.fn(),
  imageValidationError: vi.fn(),
}));

vi.mock("@/features/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/shared/lib/images", () => ({
  imageValidationError: mocks.imageValidationError,
}));
vi.mock("@/shared/cloudinary/server", () => ({
  mediaConfigured: mocks.mediaConfigured,
  uploadPrivateImage: mocks.uploadPrivateImage,
  deletePrivateImage: mocks.deletePrivateImage,
}));

import {
  deleteGroup,
  leaveGroup,
  manageMember,
  regenerateInvite,
  updateGroup,
  updateGroupAvatar,
} from "./manage-actions";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";

function form(entries: Record<string, string | File>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(entries)) data.set(k, v);
  return data;
}

function chain(result: unknown) {
  const obj = {
    select: vi.fn(() => obj),
    update: vi.fn(() => obj),
    delete: vi.fn(() => obj),
    eq: vi.fn(() => obj),
    is: vi.fn(() => obj),
    maybeSingle: vi.fn(async () => result),
  };
  return obj;
}

describe("groups manage-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mediaConfigured.mockReturnValue(true);
    mocks.imageValidationError.mockResolvedValue(null);
    mocks.uploadPrivateImage.mockResolvedValue(undefined);
    mocks.deletePrivateImage.mockResolvedValue(undefined);
  });

  it("actualiza el grupo solo si el usuario es admin", async () => {
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(chain({ data: { role: "member" }, error: null })),
    };
    mocks.requireUser.mockResolvedValue({ supabase, user: { id: USER_ID } });
    expect(
      await updateGroup(
        {},
        form({ group_id: GROUP_ID, name: "Nuevo", description: "Desc" }),
      ),
    ).toMatchObject({ error: expect.stringContaining("administrador") });

    const okSupabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(chain({ data: { role: "admin" }, error: null }))
        .mockReturnValueOnce(chain({ data: { id: GROUP_ID }, error: null })),
    };
    mocks.requireUser.mockResolvedValue({
      supabase: okSupabase,
      user: { id: USER_ID },
    });
    expect(
      await updateGroup(
        {},
        form({ group_id: GROUP_ID, name: "Nuevo", description: "Desc" }),
      ),
    ).toEqual({ success: "Grupo actualizado." });
  });

  it("reintenta regenerateInvite ante colisión 23505", async () => {
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(chain({ data: { role: "admin" }, error: null }))
        .mockReturnValueOnce(chain({ data: null, error: { code: "23505" } }))
        .mockReturnValueOnce(chain({ data: { id: GROUP_ID }, error: null })),
    };
    mocks.requireUser.mockResolvedValue({ supabase, user: { id: USER_ID } });
    expect(
      await regenerateInvite({}, form({ group_id: GROUP_ID })),
    ).toMatchObject({
      success: expect.stringContaining("Invitación renovada"),
    });
  });

  it("protege al último admin en manageMember y leaveGroup", async () => {
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(chain({ data: { role: "admin" }, error: null }))
        .mockReturnValueOnce(chain({ data: null, error: { code: "23514" } })),
    };
    mocks.requireUser.mockResolvedValue({ supabase, user: { id: USER_ID } });
    expect(
      await manageMember(
        {},
        form({ group_id: GROUP_ID, user_id: OTHER_ID, operation: "member" }),
      ),
    ).toMatchObject({
      error: expect.stringContaining("al menos un administrador"),
    });

    const leaveSupabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(chain({ data: null, error: { code: "23514" } })),
    };
    mocks.requireUser.mockResolvedValue({
      supabase: leaveSupabase,
      user: { id: USER_ID },
    });
    expect(await leaveGroup({}, form({ group_id: GROUP_ID }))).toMatchObject({
      error: expect.stringContaining("nombra a otro administrador"),
    });

    const leaveOk = {
      from: vi
        .fn()
        .mockReturnValueOnce(
          chain({ data: { user_id: USER_ID }, error: null }),
        ),
    };
    mocks.requireUser.mockResolvedValue({
      supabase: leaveOk,
      user: { id: USER_ID },
    });
    await expect(leaveGroup({}, form({ group_id: GROUP_ID }))).rejects.toThrow(
      "REDIRECT:/groups",
    );
  });

  it("exige confirmación en deleteGroup y limpia assets en Cloudinary", async () => {
    const rpc = vi.fn(async () => ({
      data: ["groups/a", "receipts/b"],
      error: null,
    }));
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(chain({ data: { role: "admin" }, error: null }))
        .mockReturnValueOnce(chain({ data: { role: "admin" }, error: null })),
      rpc,
    };
    mocks.requireUser.mockResolvedValue({ supabase, user: { id: USER_ID } });

    expect(
      await deleteGroup({}, form({ group_id: GROUP_ID, confirmation: "NO" })),
    ).toMatchObject({ error: expect.stringContaining("ELIMINAR") });

    await expect(
      deleteGroup({}, form({ group_id: GROUP_ID, confirmation: "ELIMINAR" })),
    ).rejects.toThrow("REDIRECT:/groups");
    expect(mocks.deletePrivateImage).toHaveBeenCalledWith("groups/a");
    expect(mocks.deletePrivateImage).toHaveBeenCalledWith("receipts/b");
  });

  it("reemplaza el avatar del grupo y borra el anterior al confirmar", async () => {
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(chain({ data: { role: "admin" }, error: null }))
        .mockReturnValueOnce(
          chain({ data: { avatar_public_id: "groups/old" }, error: null }),
        )
        .mockReturnValueOnce(chain({ data: { id: GROUP_ID }, error: null })),
    };
    mocks.requireUser.mockResolvedValue({ supabase, user: { id: USER_ID } });
    const file = new File(["img"], "avatar.webp", { type: "image/webp" });

    expect(
      await updateGroupAvatar({}, form({ group_id: GROUP_ID, avatar: file })),
    ).toEqual({ success: "Imagen actualizada." });
    expect(mocks.uploadPrivateImage).toHaveBeenCalledTimes(1);
    expect(mocks.deletePrivateImage).toHaveBeenCalledWith("groups/old");
  });
});
