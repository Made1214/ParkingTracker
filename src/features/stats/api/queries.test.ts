import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), notFound: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
import { getGroupStats } from "./queries";

const group = "10000000-0000-4000-8000-000000000001";
const E1 = "20000000-0000-4000-8000-000000000001";
const E3 = "20000000-0000-4000-8000-000000000003";
const SELF = "00000000-0000-4000-8000-000000000010";
const ANA = "00000000-0000-4000-8000-000000000011";
const LUIS = "00000000-0000-4000-8000-000000000012";

type Result = { data: unknown; error: object | null };

/** Prepara la respuesta agregada de Postgres para un grupo visible. */
function setup(result: Result = populated()) {
  const rpc = vi.fn().mockResolvedValue(result);
  mocks.session.mockResolvedValue({
    user: { id: SELF },
    supabase: { rpc },
  });
  return rpc;
}

/** Un grupo con dos salidas terminadas, una por venir y tres miembros. */
function populated(): Result {
  return {
    data: {
      groupName: "Los de siempre",
      members: 3,
      history: [
        {
          id: E3,
          title: "Cine",
          location: "Multiplaza",
          startsAt: "2026-06-01T15:00:00Z",
          going: 1,
          photos: 1,
          cents: 1000,
        },
        {
          id: E1,
          title: "Asado",
          location: "Playa Santa Clara",
          startsAt: "2026-05-02T15:00:00Z",
          going: 2,
          photos: 3,
          cents: 8550,
        },
      ],
      ranking: [
        {
          user_id: SELF,
          display_name: "Made",
          events_attended: 4,
          events_invited: 6,
        },
        {
          user_id: ANA,
          display_name: "Ana",
          events_attended: 2,
          events_invited: 3,
        },
        {
          user_id: LUIS,
          display_name: "Luis",
          events_attended: 3,
          events_invited: 3,
        },
      ],
      months: { "2026-05": 1, "2026-06": 2 },
      averageAttendance: 50,
      totalCents: 9550,
      averageCents: 4775,
      photoCount: 4,
      usedBytes: 52428800,
      quotaBytes: 104857600,
    },
    error: null,
  };
}

describe("group statistics aggregation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    mocks.notFound.mockImplementation(() => {
      throw new Error("not found");
    });
  });
  afterEach(() => vi.useRealTimers());

  it("aggregates history, ranking, months and money", async () => {
    const rpc = setup();
    const stats = await getGroupStats(group);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_group_stats", {
      p_group_id: group,
    });
    expect(stats.groupName).toBe("Los de siempre");
    expect(stats.members).toBe(3);
    expect(stats.history).toEqual([
      {
        id: E3,
        title: "Cine",
        location: "Multiplaza",
        startsAt: "2026-06-01T15:00:00Z",
        going: 1,
        photos: 1,
        cents: 1000,
      },
      {
        id: E1,
        title: "Asado",
        location: "Playa Santa Clara",
        startsAt: "2026-05-02T15:00:00Z",
        going: 2,
        photos: 3,
        cents: 8550,
      },
    ]);
    expect(stats.months.map((month) => month.key)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
    expect(stats.months.map((month) => month.total)).toEqual([
      0, 0, 0, 0, 1, 2,
    ]);
    expect(stats.months.map((month) => month.current)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(stats.ranking).toEqual([
      { id: SELF, name: "Tú", initialsOf: "Made", attended: 4, invited: 6 },
      { id: LUIS, name: "Luis", initialsOf: "Luis", attended: 3, invited: 3 },
      { id: ANA, name: "Ana", initialsOf: "Ana", attended: 2, invited: 3 },
    ]);
    expect(stats.averageAttendance).toBe(50);
    expect(stats.totalCents).toBe(9550);
    expect(stats.averageCents).toBe(4775);
    expect(stats.photoCount).toBe(4);
    expect(stats.usedBytes).toBe(52428800);
    expect(stats.quotaBytes).toBe(104857600);
  });

  it("labels the six-month window in Spanish", async () => {
    setup(populated());
    const stats = await getGroupStats(group);
    const label = (key: string) =>
      new Intl.DateTimeFormat("es-PA", { month: "short", timeZone: "UTC" })
        .format(new Date(`${key}-15T00:00:00Z`))
        .replace(".", "");
    expect(stats.months.map((month) => month.label)).toEqual(
      ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map(
        label,
      ),
    );
  });

  it("returns empty aggregates for a group without activity", async () => {
    setup({
      data: {
        groupName: "Nuevo",
        members: 0,
        history: [],
        ranking: [],
        months: {},
        averageAttendance: null,
        totalCents: 0,
        averageCents: 0,
        photoCount: 0,
        usedBytes: 0,
        quotaBytes: 104857600,
      },
      error: null,
    });
    const stats = await getGroupStats(group);
    expect(stats.history).toEqual([]);
    expect(stats.members).toBe(0);
    expect(stats.months.every((month) => month.total === 0)).toBe(true);
    expect(stats.ranking).toEqual([]);
    expect(stats.averageAttendance).toBeNull();
    expect(stats.averageCents).toBe(0);
    expect(stats.totalCents).toBe(0);
    expect(stats.photoCount).toBe(0);
    expect(stats.usedBytes).toBe(0);
    expect(stats.quotaBytes).toBe(104857600);
  });

  it("fails loudly when any aggregate query fails", async () => {
    setup({ data: null, error: { code: "PGRST" } });
    await expect(getGroupStats(group)).rejects.toThrow(
      "No se pudieron cargar las estadísticas.",
    );
  });

  it("does not reveal groups hidden by RLS", async () => {
    setup({ data: null, error: null });
    await expect(getGroupStats(group)).rejects.toThrow("not found");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("rejects malformed group identifiers before querying", async () => {
    const rpc = setup();
    await expect(getGroupStats("not-a-guid")).rejects.toThrow("not found");
    expect(rpc).not.toHaveBeenCalled();
  });
});
