import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  update: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { cancelEvent } from "./actions";

const ids = {
  group_id: "10000000-0000-4000-8000-000000000001",
  event_id: "20000000-0000-4000-8000-000000000002",
};
function form(extra: Record<string, string> = {}) {
  const data = new FormData();
  for (const [k, v] of Object.entries({ ...ids, ...extra })) data.set(k, v);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  const chain: Record<string, unknown> = {};
  for (const op of ["eq", "gt", "select"]) chain[op] = () => chain;
  chain.maybeSingle = () =>
    Promise.resolve({ data: { id: ids.event_id }, error: null });
  mocks.update.mockReturnValue(chain);
  mocks.session.mockResolvedValue({
    supabase: { from: () => ({ update: mocks.update }) },
  });
});

describe("cancelEvent con motivo", () => {
  it("guarda el motivo en la misma actualización que cancela", async () => {
    expect(
      await cancelEvent({}, form({ cancel_reason: "  Pronóstico de lluvia " })),
    ).toEqual({ success: "Evento cancelado." });
    expect(mocks.update).toHaveBeenCalledWith({
      status: "cancelled",
      cancel_reason: "Pronóstico de lluvia",
    });
  });

  it("sin motivo guarda null", async () => {
    await cancelEvent({}, form());
    expect(mocks.update).toHaveBeenCalledWith({
      status: "cancelled",
      cancel_reason: null,
    });
  });

  it("rechaza motivos de más de 300 caracteres sin tocar la base", async () => {
    expect(
      await cancelEvent({}, form({ cancel_reason: "x".repeat(301) })),
    ).toEqual({ error: "El motivo admite hasta 300 caracteres." });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
