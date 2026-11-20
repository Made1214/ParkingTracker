import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, formData, has, ids } from "@/test/fake-supabase";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/features/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/shared/lib/images", () => ({
  imageValidationError: () => null,
}));
vi.mock("@/shared/cloudinary/server", () => ({
  mediaConfigured: () => true,
  uploadPrivateImage: mocks.upload,
  deletePrivateImage: mocks.remove,
}));

import { uploadReceiptImage } from "./actions";

const draft = {
  created_by: ids.ana,
  image_public_id: null,
  status: "draft",
  version: 2,
};

/** Construye una solicitud de carga para el borrador de prueba. */
function imageForm() {
  const form = formData({
    group_id: ids.group,
    event_id: ids.event,
    receipt_id: ids.item,
    version: "2",
  });
  form.set("image", new File(["photo"], "receipt.png", { type: "image/png" }));
  return form;
}

describe("uploadReceiptImage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    ["otra salida", null, "published"],
    ["otro autor", { ...draft, created_by: ids.luis }, "published"],
    ["finalizado", { ...draft, status: "finalized" }, "published"],
    ["versión anterior", { ...draft, version: 3 }, "published"],
    ["salida cancelada", draft, "cancelled"],
  ])("rechaza %s antes de subir la imagen", async (_, receipt, status) => {
    const fake = fakeSupabase(({ table }) => {
      if (table === "receipts") return { data: receipt };
      if (table === "events") return { data: { status } };
      return {};
    });
    mocks.requireUser.mockResolvedValue({
      supabase: fake.client,
      user: { id: ids.ana },
    });

    expect((await uploadReceiptImage(imageForm())).ok).toBe(false);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(fake.to("receipts")[0].ops).toContainEqual([
      "eq",
      ["event_id", ids.event],
    ]);
  });

  it("limpia la imagen nueva si otro guardado se adelanta", async () => {
    const fake = fakeSupabase((call) => {
      if (call.table === "events") return { data: { status: "published" } };
      return has(call, "update") ? {} : { data: draft };
    });
    mocks.requireUser.mockResolvedValue({
      supabase: fake.client,
      user: { id: ids.ana },
    });
    mocks.remove.mockResolvedValue(undefined);

    expect((await uploadReceiptImage(imageForm())).ok).toBe(false);
    const publicId = mocks.upload.mock.calls[0][1];
    expect(mocks.remove).toHaveBeenCalledWith(publicId);
    expect(fake.to("receipts")[1].ops).toContainEqual(["eq", ["version", 2]]);
  });
});
