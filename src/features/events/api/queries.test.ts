import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
import { EVENT_PAGE_SIZE, eventTab, listEventPage } from "./queries";

const group = "10000000-0000-4000-8000-000000000001";
const cursor = "20000000-0000-4000-8000-000000000002";
const NOW = "2026-11-12T15:00:00.000Z";

type Ops = [string, unknown[]][];
/** Registra cada cadena; la que pide `maybeSingle` es la búsqueda del cursor. */
function db(rows: object[], cursorRow: object | null = null) {
  const calls: Ops[] = [];
  const from = () => {
    const ops: Ops = [];
    calls.push(ops);
    const chain: Record<string, unknown> = {};
    for (const op of ["select", "eq", "or", "order", "limit"])
      chain[op] = (...args: unknown[]) => {
        ops.push([op, args]);
        return chain;
      };
    chain.maybeSingle = () => Promise.resolve({ data: cursorRow, error: null });
    chain.then = (ok: (v: unknown) => unknown) =>
      ok({ data: rows, error: null });
    return chain;
  };
  mocks.session.mockResolvedValue({ supabase: { from } });
  return calls;
}
const event = (i: number, status = "published") => ({
  id: `30000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  status,
  starts_at: "2026-11-20T12:00:00+00:00",
  ends_at: "2026-11-20T20:00:00+00:00",
});
const args = (ops: Ops, name: string) =>
  ops.filter(([n]) => n === name).map(([, a]) => a);

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ["Date"] });
});
afterEach(() => vi.useRealTimers());

describe("listEventPage", () => {
  it("Próximas: borradores y publicadas sin terminar, de la más cercana", async () => {
    const calls = db([event(1, "draft"), event(2)]);
    const page = await listEventPage(group, "proximas");
    const [ops] = calls;
    expect(args(ops, "or")).toEqual([
      [`status.eq.draft,and(status.eq.published,ends_at.gt."${NOW}")`],
    ]);
    expect(args(ops, "order")).toEqual([
      ["starts_at", { ascending: true }],
      ["id", { ascending: true }],
    ]);
    expect(args(ops, "limit")).toEqual([[EVENT_PAGE_SIZE + 1]]);
    expect(page).toMatchObject({ nextCursor: null, isFirstPage: true });
    expect(page.events).toHaveLength(2);
  });

  it("Pasadas: terminadas o canceladas, de la más reciente", async () => {
    const calls = db([]);
    await listEventPage(group, "pasadas");
    const [ops] = calls;
    expect(args(ops, "or")).toEqual([
      [
        `status.in.(finished,cancelled),and(status.eq.published,ends_at.lte."${NOW}")`,
      ],
    ]);
    expect(args(ops, "order")[0]).toEqual(["starts_at", { ascending: false }]);
  });

  it("devuelve cursor cuando hay más de una página", async () => {
    const rows = Array.from({ length: EVENT_PAGE_SIZE + 1 }, (_, i) =>
      event(i + 1),
    );
    db(rows);
    const page = await listEventPage(group, "proximas");
    expect(page.events).toHaveLength(EVENT_PAGE_SIZE);
    expect(page.nextCursor).toBe(rows[EVENT_PAGE_SIZE - 1].id);
  });

  it("continúa después del cursor por (starts_at, id)", async () => {
    const calls = db([], {
      id: cursor,
      starts_at: "2026-11-01T12:00:00+00:00",
    });
    const page = await listEventPage(group, "pasadas", cursor);
    const [lookup, ops] = calls;
    expect(args(lookup, "eq")).toContainEqual(["id", cursor]);
    expect(args(ops, "or")[1]).toEqual([
      `starts_at.lt."2026-11-01T12:00:00+00:00",and(starts_at.eq."2026-11-01T12:00:00+00:00",id.lt.${cursor})`,
    ]);
    expect(page.isFirstPage).toBe(false);
  });

  it("ignora cursores inválidos o de otro grupo", async () => {
    let calls = db([]);
    expect((await listEventPage(group, "proximas", "x")).isFirstPage).toBe(
      true,
    );
    expect(calls).toHaveLength(1);
    calls = db([], null);
    expect((await listEventPage(group, "proximas", cursor)).isFirstPage).toBe(
      true,
    );
    expect(args(calls[1], "or")).toHaveLength(1);
  });

  it("marca como finalizadas las publicadas que ya terminaron", async () => {
    db([{ ...event(1), ends_at: "2026-11-10T00:00:00+00:00" }]);
    const page = await listEventPage(group, "pasadas");
    expect(page.events[0].status).toBe("finished");
  });
});

it.each([
  [undefined, "proximas"],
  ["pasadas", "pasadas"],
  [["pasadas", "x"], "pasadas"],
  ["otra", "proximas"],
] as const)("eventTab(%s) → %s", (value, expected) => {
  expect(eventTab(value as string | string[] | undefined)).toBe(expected);
});
