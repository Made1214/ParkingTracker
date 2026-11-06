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
import { updateEventCover } from "./cover-actions";

const group = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";
const original = `events/${group}/${eventId}/11111111-1111-4111-8111-111111111111`;
function setup(owner = true, saved = true) {
  const event = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          created_by: owner ? "user" : "other",
          status: "published",
          starts_at: "2099-01-01",
          cover_public_id: original,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: saved ? { id: eventId } : null,
        error: null,
      }),
  };
  const member = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: { role: "member" }, error: null }),
  };
  mocks.session.mockResolvedValue({
    user: { id: "user" },
    supabase: {
      from: (table: string) => (table === "events" ? event : member),
    },
  });
  const form = new FormData();
  form.set("event_id", eventId);
  form.set("group_id", group);
  form.set(
    "cover",
    new File(["test image"], "cover.webp", { type: "image/webp" }),
  );
  return { event, form };
}

describe("event cover mutation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.upload.mockResolvedValue({});
    mocks.remove.mockResolvedValue({});
  });
  it("rejects another member before calling the media provider", async () => {
    const { form } = setup(false);
    expect((await updateEventCover({}, form)).error).toBeTruthy();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects oversized images before upload", async () => {
    const { form } = setup();
    form.set(
      "cover",
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.webp", {
        type: "image/webp",
      }),
    );
    expect((await updateEventCover({}, form)).error).toContain("5 MB");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("replaces the database reference before removing the old asset", async () => {
    const { form } = setup();
    expect((await updateEventCover({}, form)).success).toBeTruthy();
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledWith(original);
    expect(mocks.revalidate).toHaveBeenCalledOnce();
  });
  it("cleans up only the new upload after a concurrent edit", async () => {
    const { form } = setup(true, false);
    expect((await updateEventCover({}, form)).error).toContain("cambió");
    expect(mocks.remove).toHaveBeenCalledWith(mocks.upload.mock.calls[0][1]);
    expect(mocks.remove).not.toHaveBeenCalledWith(original);
  });
  it("preserves the old reference if the provider rejects the image", async () => {
    const { form, event } = setup();
    mocks.upload.mockRejectedValue(new Error("provider unavailable"));
    expect((await updateEventCover({}, form)).error).toBeTruthy();
    expect(event.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
