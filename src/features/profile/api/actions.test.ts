import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/shared/cloudinary/server", () => ({
  deletePrivateImage: vi.fn(),
  mediaConfigured: () => false,
  uploadPrivateImage: vi.fn(),
}));
import { updateProfile } from "./actions";

beforeEach(() => vi.resetAllMocks());
function setup(error: object | null = null) {
  const query = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: error ? null : { id: "self" }, error }),
  };
  mocks.session.mockResolvedValue({
    user: { id: "self" },
    supabase: { from: () => query },
  });
  const form = new FormData();
  form.set("display_name", " My Name ");
  form.set("username", "User_NAME");
  form.set("id", "someone-else");
  return { query, form };
}
it("derives the edited account from the session and normalizes usernames", async () => {
  const { query, form } = setup();
  expect((await updateProfile({}, form)).success).toBeTruthy();
  expect(query.update).toHaveBeenCalledWith({
    display_name: "My Name",
    username: "user_name",
  });
  expect(query.eq).toHaveBeenCalledWith("id", "self");
});
it("gives a useful error for a username collision", async () => {
  const { form } = setup({ code: "23505" });
  expect((await updateProfile({}, form)).error).toContain("ya está en uso");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("rejects malformed usernames before querying", async () => {
  const { form, query } = setup();
  form.set("username", "bad/name");
  expect((await updateProfile({}, form)).error).toBeTruthy();
  expect(query.update).not.toHaveBeenCalled();
});
