import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  serverClient: vi.fn(),
  mediaConfigured: vi.fn(),
  privateImageUrl: vi.fn(),
}));

vi.mock("@/shared/supabase/server", () => ({
  serverClient: mocks.serverClient,
}));
vi.mock("@/shared/lib/request-id", () => ({
  currentRequestId: async () => "req_test",
}));
vi.mock("@/shared/cloudinary/server", () => ({
  mediaConfigured: mocks.mediaConfigured,
  privateImageUrl: mocks.privateImageUrl,
}));

import { groupAvatarResponse } from "./avatar-route";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

function mockDb(user: { id: string } | null, avatarPublicId: string | null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data: avatarPublicId ? { avatar_public_id: avatarPublicId } : null,
      error: null,
    })),
  };
  mocks.serverClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    from: vi.fn(() => query),
  });
}

describe("groupAvatarResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mediaConfigured.mockReturnValue(true);
    mocks.privateImageUrl.mockReturnValue("https://res.cloudinary.com/signed");
  });

  it("devuelve 404 para UUID inválido y 401 sin sesión", async () => {
    expect((await groupAvatarResponse("bad")).status).toBe(404);
    mockDb(null, null);
    expect((await groupAvatarResponse(GROUP_ID)).status).toBe(401);
  });

  it("devuelve 404 sin avatar y 503 si Cloudinary no está configurado", async () => {
    mockDb({ id: "u1" }, null);
    expect((await groupAvatarResponse(GROUP_ID)).status).toBe(404);

    mockDb({ id: "u1" }, "groups/1/avatar");
    mocks.mediaConfigured.mockReturnValue(false);
    expect((await groupAvatarResponse(GROUP_ID)).status).toBe(503);
  });

  it("sirve el avatar privado con Cache-Control private, no-store", async () => {
    mockDb({ id: "u1" }, "groups/1/avatar");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("webp-bytes", {
            status: 200,
            headers: { "content-type": "image/webp" },
          }),
      ),
    );
    const res = await groupAvatarResponse(GROUP_ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    vi.unstubAllGlobals();
  });
});
