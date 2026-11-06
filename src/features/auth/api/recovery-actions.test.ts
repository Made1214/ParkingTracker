import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  requireUser: vi.fn(),
  reset: vi.fn(),
  update: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/shared/supabase/server", () => ({ serverClient: mocks.client }));
vi.mock("@/shared/lib/env", () => ({
  publicEnv: () => ({ appUrl: "https://parking.example" }),
}));
vi.mock("./session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { requestPasswordReset, resetPassword } from "./recovery-actions";

describe("password recovery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const supabase = {
      auth: { resetPasswordForEmail: mocks.reset, updateUser: mocks.update },
    };
    mocks.client.mockResolvedValue(supabase);
    mocks.requireUser.mockResolvedValue({ supabase, user: { id: "user" } });
    mocks.reset.mockResolvedValue({ error: null });
    mocks.update.mockResolvedValue({ error: null });
  });
  it("validates the email before contacting auth", async () => {
    const form = new FormData();
    form.set("email", "invalid");
    expect((await requestPasswordReset({}, form)).error).toBeTruthy();
    expect(mocks.reset).not.toHaveBeenCalled();
  });
  it("uses the fixed PKCE callback and gives a non-enumerating response", async () => {
    const form = new FormData();
    form.set("email", "member@example.test");
    form.set("redirectTo", "https://attacker.test");
    expect((await requestPasswordReset({}, form)).success).toContain(
      "Si existe una cuenta",
    );
    expect(mocks.reset).toHaveBeenCalledWith("member@example.test", {
      redirectTo:
        "https://parking.example/auth/callback?next=%2Freset-password",
    });
  });
  it("shows a retry path when auth is unavailable", async () => {
    mocks.reset.mockResolvedValue({ error: { status: 429 } });
    const form = new FormData();
    form.set("email", "member@example.test");
    expect((await requestPasswordReset({}, form)).error).toContain(
      "inténtalo de nuevo",
    );
  });
  it("rejects mismatched passwords without mutating auth", async () => {
    const form = new FormData();
    form.set("password", "longpassword");
    form.set("confirm_password", "different");
    expect((await resetPassword({}, form)).error).toContain("no coinciden");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("requires a verified session before changing the password", async () => {
    mocks.requireUser.mockRejectedValue(new Error("redirect to login"));
    const form = new FormData();
    form.set("password", "longpassword");
    form.set("confirm_password", "longpassword");
    await expect(resetPassword({}, form)).rejects.toThrow("redirect to login");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("redirects after a successful password change", async () => {
    const form = new FormData();
    form.set("password", "longpassword");
    form.set("confirm_password", "longpassword");
    await resetPassword({}, form);
    expect(mocks.update).toHaveBeenCalledWith({ password: "longpassword" });
    expect(mocks.redirect).toHaveBeenCalledWith("/profile?password=updated");
  });
});
