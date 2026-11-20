import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
import { COMMENT_PAGE_SIZE, getComments } from "./queries";

const group = "10000000-0000-4000-8000-000000000001";
const event = "20000000-0000-4000-8000-000000000002";

type Row = {
  id: string;
  parent_id: string | null;
  body: string;
  author_id: string;
  created_at: string;
  updated_at: string;
};
const row = (id: string, minute: number, parent: string | null = null): Row => {
  const at = new Date(Date.UTC(2026, 10, 1, 12, minute)).toISOString();
  return {
    id,
    parent_id: parent,
    body: id,
    author_id: "user",
    created_at: at,
    updated_at: at,
  };
};

/** PostgREST falso: resuelve cada cadena según los filtros que recibió. */
function database(rows: Row[]) {
  const calls: { table: string; ops: [string, unknown[]][] }[] = [];
  const from = (table: string) => {
    const ops: [string, unknown[]][] = [];
    calls.push({ table, ops });
    const has = (op: string) => ops.find(([name]) => name === op);
    const resolve = () => {
      if (table === "group_members")
        return {
          data: [{ user_id: "user", role: "member", profiles: null }],
          error: null,
        };
      if (table === "events")
        return {
          data: { created_by: "user", status: "published" },
          error: null,
        };
      const select = has("select");
      if ((select?.[1][1] as { head?: boolean })?.head)
        return { count: rows.length, data: null, error: null };
      if (has("is")) {
        const limit = has("limit")?.[1][0] as number;
        const before = /created_at.lt."([^"]+)"/.exec(
          String(has("or")?.[1][0]),
        )?.[1];
        const roots = rows
          .filter((r) => !r.parent_id && (!before || r.created_at < before))
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        return { data: roots.slice(0, limit), error: null };
      }
      const parents = has("in")?.[1][1] as string[];
      return {
        data: rows.filter((r) => r.parent_id && parents.includes(r.parent_id)),
        error: null,
      };
    };
    const chain: Record<string, unknown> = {};
    for (const op of ["select", "eq", "is", "in", "order", "limit", "or"])
      chain[op] = (...args: unknown[]) => {
        ops.push([op, args]);
        return chain;
      };
    chain.maybeSingle = () => Promise.resolve(resolve());
    chain.then = (ok: (value: unknown) => unknown) => ok(resolve());
    return chain;
  };
  mocks.session.mockResolvedValue({ user: { id: "user" }, supabase: { from } });
  return calls;
}

beforeEach(() => vi.resetAllMocks());

describe("getComments", () => {
  it("devuelve los hilos más recientes en orden cronológico con sus respuestas", async () => {
    const rows = [
      ...Array.from({ length: 25 }, (_, i) => row(`root-${i}`, i)),
      row("reply-old", 30, "root-0"),
      row("reply-new", 31, "root-24"),
    ];
    database(rows);
    const result = await getComments(group, event);
    expect(result.total).toBe(27);
    expect(result.nextCursor).toBeTruthy();
    expect(result.threads).toHaveLength(COMMENT_PAGE_SIZE);
    expect(result.threads[0].id).toBe("root-5");
    expect(result.threads.at(-1)?.id).toBe("root-24");
    expect(result.threads.at(-1)?.replies.map((r) => r.id)).toEqual([
      "reply-new",
    ]);
  });

  it("pide solo las respuestas de los hilos visibles", async () => {
    const calls = database([row("a", 1), row("b", 2), row("r", 3, "a")]);
    const result = await getComments(group, event);
    expect(result.nextCursor).toBeNull();
    expect(result.threads.map((t) => t.id)).toEqual(["a", "b"]);
    const replies = calls.find((c) => c.ops.some(([op]) => op === "in"));
    expect(replies?.ops.find(([op]) => op === "in")?.[1]).toEqual([
      "parent_id",
      ["a", "b"],
    ]);
  });

  it("no consulta respuestas si no hay comentarios", async () => {
    const calls = database([]);
    const result = await getComments(group, event);
    expect(result.threads).toEqual([]);
    expect(calls.some((c) => c.ops.some(([op]) => op === "in"))).toBe(false);
  });
  it("recorre más de 200 hilos sin repetirlos", async () => {
    database(
      Array.from({ length: 223 }, (_, i) =>
        row(`30000000-0000-4000-8000-${String(i).padStart(12, "0")}`, i),
      ),
    );
    const seen = new Set<string>();
    let page = await getComments(group, event);
    for (let i = 0; i < 12; i++) {
      for (const thread of page.threads) seen.add(thread.id);
      if (!page.nextCursor) break;
      page = await getComments(group, event, page.nextCursor);
    }
    expect(seen.size).toBe(223);
    expect(page.nextCursor).toBeNull();
  });
});
