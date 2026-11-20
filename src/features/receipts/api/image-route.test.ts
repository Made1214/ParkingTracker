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

import { receiptImageResponse } from "./image-route";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const RECEIPT_ID = "33333333-3333-4333-8333-333333333333";

function mockDb(user: { id: string } | null, imagePublicId: string | null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data: imagePublicId ? { image_public_id: imagePublicId } : null,
      error: null,
    })),
  };
  mocks.serverClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    from: vi.fn(() => query),
  });
}

describe("receiptImageResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mediaConfigured.mockReturnValue(true);
    mocks.privateImageUrl.mockReturnValue("https://res.cloudinary.com/signed");
  });

  it("valida UUIDs, sesión, existencia y configuración de Cloudinary", async () => {
    expect(
      (await receiptImageResponse("bad", EVENT_ID, RECEIPT_ID)).status,
    ).toBe(404);

    mockDb(null, null);
    expect(
      (await receiptImageResponse(GROUP_ID, EVENT_ID, RECEIPT_ID)).status,
    ).toBe(401);

    mockDb({ id: "u1" }, null);
    expect(
      (await receiptImageResponse(GROUP_ID, EVENT_ID, RECEIPT_ID)).status,
    ).toBe(404);

    mockDb({ id: "u1" }, "receipts/1/img");
    mocks.mediaConfigured.mockReturnValue(false);
    expect(
      (await receiptImageResponse(GROUP_ID, EVENT_ID, RECEIPT_ID)).status,
    ).toBe(503);
  });

  it("sirve la imagen de factura con no-store y rechaza respuestas no-imagen", async () => {
    mockDb({ id: "u1" }, "receipts/1/img");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("html", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      ),
    );
    expect(
      (await receiptImageResponse(GROUP_ID, EVENT_ID, RECEIPT_ID)).status,
    ).toBe(502);

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("img-bytes", {
            status: 200,
            headers: { "content-type": "image/webp" },
          }),
      ),
    );
    const res = await receiptImageResponse(GROUP_ID, EVENT_ID, RECEIPT_ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    vi.unstubAllGlobals();
  });
});
