import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/shared/cloudinary/server", () => ({
  deletePrivateImage: vi.fn(),
  mediaConfigured: () => false,
  uploadPrivateImage: vi.fn(),
}));
import { deletePrivateImage } from "@/shared/cloudinary/server";
import { deleteAccount, updateProfile } from "./actions";

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

function setupDeletion(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  const signOut = vi.fn().mockResolvedValue({ error: null });
  mocks.session.mockResolvedValue({
    user: { id: "self" },
    supabase: { rpc, auth: { signOut } },
  });
  const form = new FormData();
  form.set("confirmation", "ELIMINAR");
  return { rpc, signOut, form };
}
it("requires the explicit confirmation before deleting the account", async () => {
  const { rpc, form } = setupDeletion({ data: [], error: null });
  form.set("confirmation", "borrar");
  expect((await deleteAccount({}, form)).error).toContain("ELIMINAR");
  expect(rpc).not.toHaveBeenCalled();
});
it("deletes the account, cleans every returned asset and signs out", async () => {
  const row = {
    deleted_avatar_public_id: "profiles/self/avatar",
    deleted_group_avatars: ["groups/one/avatar"],
    deleted_event_covers: ["events/one/cover"],
    deleted_photos: ["photos/one/photo"],
  };
  const { rpc, signOut, form } = setupDeletion({ data: [row], error: null });
  await deleteAccount({}, form);
  expect(rpc).toHaveBeenCalledWith("delete_my_account");
  expect(deletePrivateImage).toHaveBeenCalledTimes(4);
  for (const id of [
    "profiles/self/avatar",
    "groups/one/avatar",
    "events/one/cover",
    "photos/one/photo",
  ])
    expect(deletePrivateImage).toHaveBeenCalledWith(id);
  expect(signOut).toHaveBeenCalled();
  expect(mocks.redirect).toHaveBeenCalledWith("/login");
});
it("keeps the session when account deletion fails", async () => {
  const { signOut, form } = setupDeletion({
    data: null,
    error: { code: "42501" },
  });
  expect((await deleteAccount({}, form)).error).toContain("permiso");
  expect(deletePrivateImage).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
});
