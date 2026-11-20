import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  serverClient: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/features/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/shared/supabase/server", () => ({
  serverClient: mocks.serverClient,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import { getGroup, getShellData, listGroups } from "./queries";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

function chain(result: unknown) {
  const obj = {
    select: vi.fn(() => obj),
    eq: vi.fn(() => obj),
    order: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return obj;
}

describe("groups queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista grupos y nombre del perfil en listGroups", async () => {
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(
          chain({ data: [{ id: GROUP_ID, name: "A" }], error: null }),
        )
        .mockReturnValueOnce(
          chain({ data: { display_name: "Ana" }, error: null }),
        ),
    };
    mocks.requireUser.mockResolvedValue({ supabase, user: { id: "u1" } });

    const result = await listGroups();
    expect(result.groups).toHaveLength(1);
    expect(result.displayName).toBe("Ana");
  });

  it("valida UUID y existencia en getGroup", async () => {
    mocks.requireUser.mockResolvedValue({ supabase: {}, user: { id: "u1" } });
    await expect(getGroup("not-a-uuid")).rejects.toThrow("NOT_FOUND");

    const missing = {
      from: vi.fn().mockReturnValueOnce(chain({ data: null, error: null })),
    };
    mocks.requireUser.mockResolvedValue({
      supabase: missing,
      user: { id: "u1" },
    });
    await expect(getGroup(GROUP_ID)).rejects.toThrow("NOT_FOUND");

    const ok = {
      from: vi
        .fn()
        .mockReturnValueOnce(
          chain({ data: { id: GROUP_ID, name: "Playa" }, error: null }),
        )
        .mockReturnValueOnce(
          chain({
            data: [
              {
                user_id: "u1",
                role: "admin",
                profiles: { display_name: "Ana" },
              },
            ],
            error: null,
          }),
        ),
    };
    mocks.requireUser.mockResolvedValue({ supabase: ok, user: { id: "u1" } });
    const loaded = await getGroup(GROUP_ID);
    expect(loaded.group.name).toBe("Playa");
    expect(loaded.members).toHaveLength(1);
  });

  it("resuelve avatar privado, avatar Google o null en getShellData", async () => {
    mocks.serverClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    });
    expect(await getShellData()).toBeNull();

    mocks.serverClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
      from: vi
        .fn()
        .mockReturnValueOnce(
          chain({ data: [{ id: GROUP_ID, name: "G" }], error: null }),
        )
        .mockReturnValueOnce(
          chain({
            data: {
              display_name: "Ana",
              avatar_public_id: "avatars/u1/1",
              avatar_url: null,
              updated_at: "2026-11-20T00:00:00Z",
            },
            error: null,
          }),
        ),
    });
    expect(await getShellData()).toMatchObject({
      displayName: "Ana",
      avatarSrc: "/api/profiles/u1/avatar?v=2026-11-20T00%3A00%3A00Z",
    });

    mocks.serverClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
      from: vi
        .fn()
        .mockReturnValueOnce(chain({ data: [], error: null }))
        .mockReturnValueOnce(
          chain({
            data: {
              display_name: "Ana",
              avatar_public_id: null,
              avatar_url: "https://evil.example/pic.jpg",
              updated_at: "2026-11-20T00:00:00Z",
            },
            error: null,
          }),
        ),
    });
    expect((await getShellData())?.avatarSrc).toBeNull();
  });
});
