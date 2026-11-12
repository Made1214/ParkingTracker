import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn() }));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/shared/cloudinary/server", () => ({}));
import { checkUsername } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ supabase: { rpc: mocks.rpc } });
});

describe("checkUsername", () => {
  it("consulta el nombre normalizado", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    expect(await checkUsername("  Ana_T ")).toBe("available");
    expect(mocks.rpc).toHaveBeenCalledWith("is_username_available", {
      p_username: "ana_t",
    });
  });

  it("informa si está ocupado o si falla la consulta", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await checkUsername("ana_t")).toBe("taken");
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX" } });
    expect(await checkUsername("ana_t")).toBe("error");
  });

  it("no consulta la base con nombres mal formados", async () => {
    expect(await checkUsername("ab")).toBe("invalid");
    expect(await checkUsername("con espacio")).toBe("invalid");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
