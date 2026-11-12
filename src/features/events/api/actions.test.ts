import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fakeSupabase,
  formData,
  ids,
  op,
  type Result,
} from "@/test/fake-supabase";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
}));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { cancelEvent, createEvent, publishEvent, updateEvent } from "./actions";

const NOW = Date.parse("2026-11-10T15:00:00Z");
function db(result: Result = {}) {
  const fake = fakeSupabase(() => result);
  mocks.session.mockResolvedValue({
    supabase: fake.client,
    user: { id: ids.ana },
  });
  return fake;
}
const fields = (extra: Record<string, string> = {}) =>
  formData({
    group_id: ids.group,
    event_id: ids.event,
    title: "Playa",
    description: "",
    location: "Santa Clara",
    starts_at: "2026-11-14T12:00:00-05:00",
    ends_at: "2026-11-14T20:00:00-05:00",
    ...extra,
  });
const refs = formData({ group_id: ids.group, event_id: ids.event });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});
afterEach(() => vi.useRealTimers());

describe("createEvent", () => {
  it("crea la salida publicada por defecto y abre su página", async () => {
    const fake = db({ data: { id: ids.item } });
    await expect(createEvent({}, fields())).rejects.toThrow(
      `redirect:/groups/${ids.group}/events/${ids.item}`,
    );
    expect(op(fake.to("events")[0], "insert")?.[0]).toMatchObject({
      group_id: ids.group,
      title: "Playa",
      status: "published",
      created_by: ids.ana,
    });
  });

  it("puede guardarse como borrador", async () => {
    const fake = db({ data: { id: ids.item } });
    await expect(
      createEvent({}, fields({ status: "draft" })),
    ).rejects.toThrow();
    expect(op(fake.to("events")[0], "insert")?.[0]).toMatchObject({
      status: "draft",
    });
  });

  it("exige fechas futuras y un fin posterior al inicio", async () => {
    db();
    expect(
      await createEvent({}, fields({ starts_at: "2026-11-01T12:00:00-05:00" })),
    ).toEqual({
      error: "El inicio debe ser futuro y el fin posterior al inicio.",
    });
    expect(
      await createEvent({}, fields({ ends_at: "2026-11-14T11:00:00-05:00" })),
    ).toHaveProperty("error");
    expect(await createEvent({}, fields({ title: "" }))).toEqual({
      error: "Revisa el título, el grupo y las fechas del evento.",
    });
  });

  it("traduce errores de la base", async () => {
    db({ error: { code: "42501" } });
    expect(await createEvent({}, fields())).toEqual({
      error: "No tienes permiso para realizar esta acción.",
    });
  });
});

describe("updateEvent", () => {
  it("edita solo salidas en borrador o publicadas que no empezaron", async () => {
    const fake = db({ data: { id: ids.event } });
    expect(await updateEvent({}, fields())).toEqual({
      success: "Evento actualizado.",
    });
    const call = fake.to("events")[0];
    expect(op(call, "update")?.[0]).toEqual({
      title: "Playa",
      description: "",
      location: "Santa Clara",
      starts_at: "2026-11-14T12:00:00-05:00",
      ends_at: "2026-11-14T20:00:00-05:00",
    });
    expect(op(call, "in")).toEqual(["status", ["draft", "published"]]);
    expect(mocks.revalidate).toHaveBeenCalledTimes(3);
  });

  it("explica cuando RLS o el estado no dejaron editar", async () => {
    db({ data: null });
    expect((await updateEvent({}, fields())).error).toMatch(
      /No tienes permiso/,
    );
    db({ error: { code: "XX" } });
    expect((await updateEvent({}, fields())).error).toBeTruthy();
  });

  it("valida antes de tocar la base", async () => {
    expect(await updateEvent({}, fields({ event_id: "x" }))).toEqual({
      error: "Revisa el título, el lugar y las fechas del evento.",
    });
    expect(
      await updateEvent({}, fields({ starts_at: "2026-11-01T12:00:00-05:00" })),
    ).toHaveProperty("error");
    expect(mocks.session).not.toHaveBeenCalled();
  });
});

describe.each([
  ["publishEvent", publishEvent, "published", "draft", "Evento publicado."],
  ["cancelEvent", cancelEvent, "cancelled", "published", "Evento cancelado."],
] as const)("%s", (_, action, next, from, success) => {
  it(`pasa de ${from} a ${next} solo antes del inicio`, async () => {
    const fake = db({ data: { id: ids.event } });
    expect(await action({}, refs)).toEqual({ success });
    const call = fake.to("events")[0];
    expect(op(call, "update")?.[0]).toEqual({ status: next });
    expect(call.ops).toContainEqual(["eq", ["status", from]]);
    expect(op(call, "gt")).toEqual(["starts_at", new Date(NOW).toISOString()]);
  });

  it("no cambia nada si RLS lo impide o los ids no son válidos", async () => {
    db({ data: null });
    expect((await action({}, refs)).error).toMatch(/No tienes permiso/);
    db({ error: { code: "42501" } });
    expect((await action({}, refs)).error).toBeTruthy();
    expect(
      await action({}, formData({ group_id: "x", event_id: ids.event })),
    ).toEqual({ error: "No se pudo identificar el evento." });
  });
});
