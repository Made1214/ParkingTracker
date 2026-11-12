import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fakeSupabase,
  formData,
  ids,
  op,
  type Result,
} from "@/test/fake-supabase";

const mocks = vi.hoisted(() => ({ session: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { respond } from "./actions";
import { getAttendance } from "./queries";

function db(result: Result = {}) {
  const fake = fakeSupabase(() => result);
  mocks.session.mockResolvedValue({
    supabase: fake.client,
    user: { id: ids.ana },
  });
  return fake;
}
const form = (status = "going") =>
  formData({ group_id: ids.group, event_id: ids.event, status });

beforeEach(() => vi.resetAllMocks());

describe("respond", () => {
  it("guarda (o cambia) la respuesta propia con upsert", async () => {
    const fake = db();
    expect(await respond({}, form("maybe"))).toEqual({
      success: "Tu respuesta quedó guardada.",
    });
    const [row, options] = op(fake.to("event_attendance")[0], "upsert") as [
      Record<string, unknown>,
      object,
    ];
    expect(row).toMatchObject({
      group_id: ids.group,
      event_id: ids.event,
      status: "maybe",
      user_id: ids.ana,
    });
    expect(options).toEqual({ onConflict: "event_id,user_id" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/groups");
  });

  it("rechaza estados desconocidos", async () => {
    db();
    expect(await respond({}, form("quizás"))).toEqual({
      error: "La respuesta no es válida.",
    });
  });

  it("traduce el error del plazo de respuesta", async () => {
    db({ error: { code: "23514" } });
    expect(await respond({}, form())).toEqual({
      error: "Revisa los datos. La acción no cumple las reglas del evento.",
    });
  });
});

describe("getAttendance", () => {
  it("devuelve la asistencia de la salida o falla", async () => {
    db({ data: [{ user_id: ids.ana, status: "going" }] });
    expect(await getAttendance(ids.group, ids.event)).toEqual([
      { user_id: ids.ana, status: "going" },
    ]);
    db({ error: { code: "XX" } });
    await expect(getAttendance(ids.group, ids.event)).rejects.toThrow(
      "No se pudo cargar la asistencia.",
    );
  });
});
