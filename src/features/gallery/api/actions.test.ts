import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/shared/cloudinary/server", () => ({
  mediaConfigured: () => true,
  uploadPrivateImage: mocks.upload,
  deletePrivateImage: mocks.remove,
}));

import { uploadPhoto } from "./actions";

const group = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";

function setup(
  status: "draft" | "published" | "cancelled" | "finished" = "published",
  insertError: { code?: string } | null = null,
) {
  const event = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { status },
      error: null,
    }),
  };
  const photos = {
    insert: vi.fn().mockResolvedValue({ error: insertError }),
  };
  mocks.session.mockResolvedValue({
    user: { id: "00000000-0000-4000-8000-000000000002" },
    supabase: {
      from: (table: string) => (table === "events" ? event : photos),
    },
  });
  const form = new FormData();
  form.set("group_id", group);
  form.set("event_id", eventId);
  form.set(
    "photo",
    new File(["image-bytes"], "photo.webp", { type: "image/webp" }),
  );
  return { event, photos, form };
}

describe("uploadPhoto server action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.upload.mockResolvedValue({
      version: 1730000000,
      bytes: 245000,
      width: 1600,
      height: 1200,
    });
    mocks.remove.mockResolvedValue({});
  });

  it("registers verified Cloudinary bytes, width, height, and scoped public_id", async () => {
    const { photos, form } = setup("published");
    form.set("bytes", "1");
    form.set("width", "10");
    form.set("height", "10");

    const result = await uploadPhoto({}, form);
    expect(result.success).toBeTruthy();
    expect(mocks.upload).toHaveBeenCalledOnce();
    const publicId = mocks.upload.mock.calls[0][1] as string;
    expect(publicId).toMatch(
      new RegExp(`^photos/${group}/${eventId}/[0-9a-f-]{36}$`),
    );
    expect(photos.insert).toHaveBeenCalledWith({
      group_id: group,
      event_id: eventId,
      cloudinary_public_id: publicId,
      cloudinary_version: "1730000000",
      bytes: 245000,
      width: 1600,
      height: 1200,
      uploaded_by: "00000000-0000-4000-8000-000000000002",
    });
  });

  it("rejects draft and cancelled events before uploading to Cloudinary", async () => {
    const { form: draftForm } = setup("draft");
    expect((await uploadPhoto({}, draftForm)).error).toBeTruthy();
    const { form: cancelledForm } = setup("cancelled");
    expect((await uploadPhoto({}, cancelledForm)).error).toBeTruthy();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("cleans up the uploaded asset when Cloudinary returns invalid metadata", async () => {
    const { photos, form } = setup("published");
    mocks.upload.mockResolvedValueOnce({
      version: 1,
      bytes: 0,
      width: 1600,
      height: 1200,
    });
    expect((await uploadPhoto({}, form)).error).toContain("verificar");
    expect(photos.insert).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it("cleans up the uploaded asset when the database quota trigger rejects the insert", async () => {
    const { form } = setup("published", { code: "53100" });
    expect((await uploadPhoto({}, form)).error).toContain("límite");
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
});
