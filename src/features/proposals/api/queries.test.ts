import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, ids, type Call } from "@/test/fake-supabase";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
import { getLivePoll, getPolls, getProposals } from "./queries";

const NOW = Date.parse("2026-11-10T15:00:00Z");
const options = [
  { id: "o2", label: "Playa", position: 2 },
  { id: "o1", label: "Montaña", position: 1 },
];

function db(
  tables: Record<string, object>,
  results: Record<string, object> = {},
  user = ids.ana,
) {
  const fake = fakeSupabase((call: Call) => {
    if (call.table === "rpc:get_poll_results") {
      const pollId = (call.ops[0][1][0] as { p_poll_id: string }).p_poll_id;
      return results[pollId] ?? { data: [] };
    }
    return tables[call.table] ?? {};
  });
  mocks.session.mockResolvedValue({
    supabase: fake.client,
    user: { id: user },
  });
  return fake;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});
afterEach(() => vi.useRealTimers());

describe("getProposals", () => {
  it("quien organiza puede revisar propuestas", async () => {
    db({
      activity_proposals: { data: [{ id: "p1" }] },
      events: { data: { created_by: ids.ana } },
      group_members: { data: { role: "member" } },
    });
    expect(await getProposals(ids.group, ids.event)).toEqual({
      proposals: [{ id: "p1" }],
      canReview: true,
    });
  });

  it("un admin también; un miembro cualquiera no", async () => {
    db({
      activity_proposals: { data: [] },
      events: { data: { created_by: ids.luis } },
      group_members: { data: { role: "admin" } },
    });
    expect((await getProposals(ids.group, ids.event)).canReview).toBe(true);
    db({
      activity_proposals: { data: [] },
      events: { data: { created_by: ids.luis } },
      group_members: { data: { role: "member" } },
    });
    expect((await getProposals(ids.group, ids.event)).canReview).toBe(false);
  });

  it("falla si no puede leer propuestas o permisos", async () => {
    db({ activity_proposals: { error: { code: "XX" } } });
    await expect(getProposals(ids.group, ids.event)).rejects.toThrow(
      "No se pudieron cargar las propuestas.",
    );
    db({
      activity_proposals: { data: [] },
      events: { error: { code: "XX" } },
    });
    await expect(getProposals(ids.group, ids.event)).rejects.toThrow(
      "No se pudieron comprobar los permisos de propuestas.",
    );
  });
});

describe("getPolls", () => {
  const event = {
    starts_at: "2026-11-14T12:00:00Z",
    ends_at: "2026-11-14T20:00:00Z",
    created_by: ids.luis,
    status: "published",
  };

  it("adjunta los resultados de cada votación y los permisos", async () => {
    const fake = db(
      {
        polls: { data: [{ id: "p1" }, { id: "p2" }] },
        group_members: { data: { role: "admin" } },
        events: { data: event },
      },
      {
        p1: { data: [{ option_id: "o1", votes: 2 }] },
        p2: { data: [] },
      },
    );
    const result = await getPolls(ids.group, ids.event);
    expect(result.polls).toEqual([
      { id: "p1", results: [{ option_id: "o1", votes: 2 }] },
      { id: "p2", results: [] },
    ]);
    expect(result).toMatchObject({
      userId: ids.ana,
      isAdmin: true,
      canSchedule: true,
      eventStartsAt: "2026-11-14T07:00",
      eventEndsAt: "2026-11-14T15:00",
      now: NOW,
    });
    // Solo los votos propios viajan al cliente.
    expect(
      fake
        .to("polls")[0]
        .ops.filter(([n]) => n === "eq")
        .map(([, a]) => a),
    ).toContainEqual(["poll_votes.user_id", ids.ana]);
  });

  it("solo quien organiza o un admin agenda, y solo en salidas publicadas", async () => {
    db({
      polls: { data: [] },
      group_members: { data: { role: "member" } },
      events: { data: event },
    });
    expect((await getPolls(ids.group, ids.event)).canSchedule).toBe(false);
    db(
      {
        polls: { data: [] },
        group_members: { data: { role: "member" } },
        events: { data: { ...event, status: "draft" } },
      },
      {},
      ids.luis,
    );
    expect((await getPolls(ids.group, ids.event)).canSchedule).toBe(false);
  });

  it("falla sin salida o si un resultado no carga", async () => {
    db({
      polls: { data: [] },
      group_members: { data: null },
      events: { data: null },
    });
    await expect(getPolls(ids.group, ids.event)).rejects.toThrow(
      "No se pudieron cargar las votaciones.",
    );
    db(
      {
        polls: { data: [{ id: "p1" }] },
        group_members: { data: null },
        events: { data: event },
      },
      { p1: { error: { code: "XX" } } },
    );
    await expect(getPolls(ids.group, ids.event)).rejects.toThrow(
      "No se pudieron cargar los resultados.",
    );
  });
});

describe("getLivePoll", () => {
  it("toma la votación abierta más reciente que no ha vencido", async () => {
    db(
      {
        polls: {
          data: [
            {
              id: "vencida",
              question: "¿?",
              closes_at: "2026-11-10T14:00:00Z",
              poll_options: [],
            },
            {
              id: "p1",
              question: "¿A dónde?",
              closes_at: null,
              poll_options: options,
            },
            {
              id: "p0",
              question: "¿Hora?",
              closes_at: "2026-11-11T00:00:00Z",
              poll_options: [],
            },
          ],
        },
      },
      {
        p1: {
          data: [
            { option_id: "o2", votes: 3 },
            { option_id: "o1", votes: "1" },
          ],
        },
      },
    );
    expect(await getLivePoll(ids.group, ids.event)).toEqual({
      openCount: 2,
      poll: {
        id: "p1",
        question: "¿A dónde?",
        options: [
          { id: "o2", label: "Playa", percent: 75 },
          { id: "o1", label: "Montaña", percent: 25 },
        ],
      },
    });
  });

  it("sin votos los porcentajes son cero, en el orden de las opciones", async () => {
    db({
      polls: {
        data: [
          { id: "p1", question: "¿?", closes_at: null, poll_options: options },
        ],
      },
    });
    const { poll } = await getLivePoll(ids.group, ids.event);
    expect(poll?.options).toEqual([
      { id: "o1", label: "Montaña", percent: 0 },
      { id: "o2", label: "Playa", percent: 0 },
    ]);
  });

  it("sin votaciones abiertas no devuelve ninguna", async () => {
    db({ polls: { data: [] } });
    expect(await getLivePoll(ids.group, ids.event)).toEqual({
      poll: null,
      openCount: 0,
    });
  });

  it("propaga los errores", async () => {
    db({ polls: { error: { code: "XX" } } });
    await expect(getLivePoll(ids.group, ids.event)).rejects.toThrow();
    db(
      {
        polls: {
          data: [{ id: "p1", question: "", closes_at: null, poll_options: [] }],
        },
      },
      { p1: { error: { code: "XX" } } },
    );
    await expect(getLivePoll(ids.group, ids.event)).rejects.toThrow(
      "No se pudieron cargar los resultados.",
    );
  });
});
