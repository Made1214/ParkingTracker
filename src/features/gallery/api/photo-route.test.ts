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
import { photoResponse } from "./photo-route";

const group = "10000000-0000-4000-8000-000000000001";
const event = "20000000-0000-4000-8000-000000000002";
const photo = "30000000-0000-4000-8000-000000000003";
const signed = "https://example.test/signed-photo";
const publicId = `photos/${group}/${event}/${photo}`;

function session(
  user: object | null,
  row: string | null = publicId,
  error: object | null = null,
) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: row ? { cloudinary_public_id: row } : null,
      error,
    }),
  };
  mocks.client.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => query),
  });
}

describe("private gallery photo delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.configured.mockReturnValue(true);
    mocks.sign.mockReturnValue(signed);
  });
  it("rejects an invalid identifier before querying or signing", async () => {
    for (const invalid of ["invalid", group, event])
      expect((await photoResponse(invalid, "invalid", photo)).status).toBe(404);
    expect((await photoResponse(group, event, "invalid")).status).toBe(404);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("does not sign or fetch media for an unauthenticated caller", async () => {
    session(null);
    expect((await photoResponse(group, event, photo)).status).toBe(401);
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("does not sign media when RLS hides the photo", async () => {
    session({ id: "outsider" }, null);
    const response = await photoResponse(group, event, photo);
    expect(response.status).toBe(404);
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("fails safely when the database is unavailable", async () => {
    session({ id: "member" }, publicId, { code: "PGRST" });
    expect((await photoResponse(group, event, photo)).status).toBe(503);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("fails safely when media delivery is not configured", async () => {
    session({ id: "member" });
    mocks.configured.mockReturnValue(false);
    expect((await photoResponse(group, event, photo)).status).toBe(503);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("streams the signed photo without exposing or redirecting to its URL", async () => {
    session({ id: "member" });
    mocks.fetch.mockResolvedValue(
      new Response("photo bytes", {
        headers: { "Content-Type": "image/webp" },
      }),
    );
    const response = await photoResponse(group, event, photo);
    expect(response.status).toBe(200);
    expect(response.headers.get("Location")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=600");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(await response.text()).toBe("photo bytes");
    expect(mocks.sign).toHaveBeenCalledWith(publicId);
    expect(mocks.fetch).toHaveBeenCalledWith(
      signed,
      expect.objectContaining({ cache: "no-store" }),
    );
  });
  it("fails safely when the provider returns non-image data", async () => {
    session({ id: "member" });
    mocks.fetch.mockResolvedValue(
      new Response("error", { headers: { "Content-Type": "text/html" } }),
    );
    expect((await photoResponse(group, event, photo)).status).toBe(502);
  });
  it("fails safely when the provider is unreachable", async () => {
    session({ id: "member" });
    mocks.fetch.mockRejectedValue(new Error("provider unavailable"));
    expect((await photoResponse(group, event, photo)).status).toBe(502);
  });
});
