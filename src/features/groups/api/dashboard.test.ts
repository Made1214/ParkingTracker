import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));

vi.mock("@/features/auth", () => ({ requireUser: mocks.requireUser }));

import { getDashboard } from "./dashboard";

function chain(result: unknown) {
  const obj = {
    select: vi.fn(() => obj),
    eq: vi.fn(() => obj),
    neq: vi.fn(() => obj),
    gt: vi.fn(() => obj),
    in: vi.fn(() => obj),
    order: vi.fn(() => obj),
    limit: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return obj;
}

describe("getDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("incluye salidas en curso/próximas, pendientes propios y saldo agregado desde RPC", async () => {
    const start = new Date(Date.now() + 3_600_000).toISOString();
    const end = new Date(Date.now() + 7_200_000).toISOString();

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(
          chain({ data: [{ id: "g1", name: "Playa" }], error: null }),
        )
        .mockReturnValueOnce(
          chain({ data: { display_name: "Ana" }, error: null }),
        )
        .mockReturnValueOnce(
          chain({
            data: [
              {
                id: "e1",
                group_id: "g1",
                title: "Cena",
                starts_at: start,
                ends_at: end,
                location: "Casco",
                created_by: "u2",
                groups: { name: "Playa" },
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({
            data: [
              {
                event_id: "e1",
                user_id: "u1",
                status: "going",
                profiles: { display_name: "Ana" },
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({
            data: [
              {
                id: "p1",
                event_id: "e1",
                group_id: "g1",
                question: "¿Dónde?",
                poll_votes: [],
              },
              {
                id: "p2",
                event_id: "e1",
                group_id: "g1",
                question: "Votada",
                poll_votes: [{ user_id: "u1" }],
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({
            data: [
              {
                id: "t1",
                title: "Hielo",
                event_id: "e1",
                group_id: "g1",
                status: "pending",
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({ data: [{ id: "u2", display_name: "Luis" }], error: null }),
        )
        .mockReturnValueOnce(
          chain({ data: [{ id: "u3", display_name: "Sofía" }], error: null }),
        ),
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: -12.5, error: null })
        .mockResolvedValueOnce({
          data: [
            {
              event_id: "e1",
              group_id: "g1",
              title: "Cena",
              amount: 12.5,
              creditors: ["u3"],
            },
          ],
          error: null,
        }),
    };
    mocks.requireUser.mockResolvedValue({ supabase, user: { id: "u1" } });

    const dash = await getDashboard();
    expect(dash.displayName).toBe("Ana");
    expect(dash.balanceCents).toBe(-1250);
    expect(dash.upcoming).toHaveLength(1);
    expect(dash.upcoming[0]?.organizer).toBe("Luis");
    expect(dash.todo.map((item) => item.kind)).toEqual([
      "poll",
      "debt",
      "task",
    ]);
    expect(dash.todo[1]?.title).toBe("Debes $12.50 a Sofía");
  });
});
