import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fakeSupabase,
  formData,
  ids,
  op,
  type Call,
  type Result,
} from "@/test/fake-supabase";

const mocks = vi.hoisted(() => ({ session: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import {
  createScheduleItem,
  deleteScheduleItem,
  updateScheduleItem,
} from "./actions";
import { getSchedule } from "./queries";

const path = `/groups/${ids.group}/events/${ids.event}`;
function db(resolve: (call: Call) => Result = () => ({})) {
  const fake = fakeSupabase(resolve);
  mocks.session.mockResolvedValue({
    supabase: fake.client,
    user: { id: ids.ana },
  });
  return fake;
}
const item = (extra: Record<string, string> = {}) =>
  formData({
    group_id: ids.group,
    event_id: ids.event,
    title: "Almuerzo",
    starts_at: "2026-11-14T12:30",
    ...extra,
  });

beforeEach(() => vi.resetAllMocks());

describe("createScheduleItem", () => {
  it("crea la actividad a nombre de quien la añade", async () => {
    const fake = db();
    expect(await createScheduleItem({}, item())).toEqual({
      success: "Actividad añadida.",
    });
    expect(op(fake.to("schedule_items")[0], "insert")?.[0]).toMatchObject({
      title: "Almuerzo",
      starts_at: "2026-11-14T17:30:00.000Z",
      created_by: ids.ana,
    });
    expect(mocks.revalidate).toHaveBeenCalledWith(path);
  });

  it("confirma cuando la actividad viene de una propuesta", async () => {
    db();
    expect(
      await createScheduleItem({}, item({ proposal_id: ids.item })),
    ).toEqual({ success: "Propuesta añadida al cronograma." });
  });

  it("valida el formulario y traduce errores de permisos", async () => {
    expect(await createScheduleItem({}, item({ title: "" }))).toHaveProperty(
      "error",
    );
    db(() => ({ error: { code: "42501" } }));
    expect((await createScheduleItem({}, item())).error).toBeTruthy();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

describe("updateScheduleItem", () => {
  it("actualiza solo los campos editables", async () => {
    const fake = db(() => ({ data: [{ id: ids.item }] }));
    expect(await updateScheduleItem({}, item({ id: ids.item }))).toEqual({
      success: "Actividad actualizada.",
    });
    expect(op(fake.to("schedule_items")[0], "update")?.[0]).toEqual({
      title: "Almuerzo",
      description: null,
      starts_at: "2026-11-14T17:30:00.000Z",
      ends_at: null,
    });
  });

  it("rechaza ids inválidos y actualizaciones que RLS bloqueó", async () => {
    expect(await updateScheduleItem({}, item({ id: "x" }))).toEqual({
      error: "La actividad no es válida.",
    });
    db(() => ({ data: [] }));
    expect(
      (await updateScheduleItem({}, item({ id: ids.item }))).error,
    ).toBeTruthy();
    db(() => ({ error: { code: "XX" } }));
    expect(
      (await updateScheduleItem({}, item({ id: ids.item }))).error,
    ).toBeTruthy();
  });
});

describe("deleteScheduleItem", () => {
  const form = (id = ids.item) =>
    formData({ id, group_id: ids.group, event_id: ids.event });
  it("borra la actividad", async () => {
    db(() => ({ data: [{ id: ids.item }] }));
    expect(await deleteScheduleItem({}, form())).toEqual({
      success: "Actividad eliminada.",
    });
  });
  it("rechaza ids inválidos y borrados sin efecto", async () => {
    expect(await deleteScheduleItem({}, form("x"))).toEqual({
      error: "La actividad no es válida.",
    });
    db(() => ({ data: [] }));
    expect((await deleteScheduleItem({}, form())).error).toBeTruthy();
    db(() => ({ error: { code: "XX" } }));
    expect((await deleteScheduleItem({}, form())).error).toBeTruthy();
  });
});

describe("getSchedule", () => {
  const NOW = Date.parse("2026-11-10T15:00:00Z");
  beforeEach(() => vi.useFakeTimers({ now: NOW, toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  const tables =
    (event: object, role = "member") =>
    (call: Call): Result =>
      ({
        schedule_items: { data: [{ id: "s1", proposal_id: "p1" }] },
        events: { data: event },
        group_members: { data: { role } },
        activity_proposals: { data: [{ id: "p1" }, { id: "p2" }] },
      })[call.table] ?? {};
  const event = {
    starts_at: "2026-11-14T12:00:00Z",
    ends_at: "2026-11-14T20:00:00Z",
    status: "published",
    created_by: ids.ana,
  };

  it("quien organiza edita mientras la salida no termina", async () => {
    db(tables(event));
    const result = await getSchedule(ids.group, ids.event);
    expect(result.canEdit).toBe(true);
    expect(result.pendingProposals).toEqual([{ id: "p2" }]);
  });

  it("nadie edita una salida cancelada o terminada; un miembro nunca", async () => {
    db(tables({ ...event, status: "cancelled" }, "admin"));
    expect((await getSchedule(ids.group, ids.event)).canEdit).toBe(false);
    db(tables({ ...event, ends_at: "2026-11-01T00:00:00Z" }, "admin"));
    expect((await getSchedule(ids.group, ids.event)).canEdit).toBe(false);
    db(tables({ ...event, created_by: ids.luis }));
    expect((await getSchedule(ids.group, ids.event)).canEdit).toBe(false);
  });

  it("falla si alguna consulta falla", async () => {
    db((call) => (call.table === "events" ? { error: { code: "XX" } } : {}));
    await expect(getSchedule(ids.group, ids.event)).rejects.toThrow(
      "No se pudo cargar el cronograma.",
    );
  });
});
