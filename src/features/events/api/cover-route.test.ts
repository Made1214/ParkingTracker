import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  sign: vi.fn(),
  fetch: vi.fn(),
  configured: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/supabase/server", () => ({ serverClient: mocks.client }));
vi.mock("@/shared/cloudinary/server", () => ({
  mediaConfigured: mocks.configured,
  privateImageUrl: mocks.sign,
}));
import { eventCoverResponse } from "./cover-route";

const group = "10000000-0000-4000-8000-000000000001";
const event = "20000000-0000-4000-8000-000000000001";

function session(
  user: object | null,
  cover: string | null = "private-id",
  error: object | null = null,
) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: cover ? { cover_public_id: cover } : null,
      error,
    }),
  };
  mocks.client.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => query),
  });
}

describe("private event cover delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.configured.mockReturnValue(true);
    mocks.sign.mockReturnValue("https://example.test/signed-image");
  });
  it("rejects an invalid identifier before querying or signing", async () => {
    expect((await eventCoverResponse("invalid", event)).status).toBe(404);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("does not sign or fetch media for an unauthenticated caller", async () => {
    session(null);
    expect((await eventCoverResponse(group, event)).status).toBe(401);
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("does not sign media when RLS hides the event", async () => {
    session({ id: "outsider" }, null);
    expect((await eventCoverResponse(group, event)).status).toBe(404);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("streams authorized media without sharing or caching the signed URL", async () => {
    session({ id: "member" });
    mocks.fetch.mockResolvedValue(
      new Response("image bytes", {
        headers: { "Content-Type": "image/webp" },
      }),
    );
    const response = await eventCoverResponse(group, event);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Location")).toBeNull();
    expect(await response.text()).toBe("image bytes");
  });
  it("fails safely when the provider returns non-image data", async () => {
    session({ id: "member" });
    mocks.fetch.mockResolvedValue(
      new Response("error", { headers: { "Content-Type": "text/html" } }),
    );
    expect((await eventCoverResponse(group, event)).status).toBe(502);
  });
});
