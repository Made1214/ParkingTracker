import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, ids, type Call } from "@/test/fake-supabase";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
import { getExpenseSummary, getExpenses } from "./queries";

const members = [
  { user_id: ids.ana, role: "member", profiles: { display_name: "Ana" } },
  { user_id: ids.luis, role: "member", profiles: { display_name: "Luis" } },
  { user_id: ids.sofia, role: "admin", profiles: { display_name: "Sofía" } },
];
const expenses = [
  {
    id: "e1",
    description: "Cena",
    amount: 30,
    category: "comida",
    paid_by: ids.luis,
    created_by: ids.luis,
    created_at: "2026-11-01T00:00:00Z",
    expense_splits: [
      { user_id: ids.ana, share_amount: 15, settled: false },
      { user_id: ids.luis, share_amount: 15, settled: false },
    ],
  },
  {
    id: "e2",
    description: "Taxi",
    amount: "12.50",
    category: "transporte",
    paid_by: "ex-miembro",
    created_by: ids.ana,
    created_at: "2026-11-01T01:00:00Z",
    expense_splits: [{ user_id: ids.sofia, share_amount: 12.5, settled: true }],
  },
];

function db(user: string, overrides: Partial<Record<string, object>> = {}) {
  const tables: Record<string, object> = {
    group_members: { data: members },
    expenses: { data: expenses },
    "rpc:get_event_balances": {
      data: [
        { user_id: ids.ana, net_amount: -15 },
        { user_id: ids.luis, net_amount: 15 },
        { user_id: ids.sofia, net_amount: 0 },
      ],
    },
    "rpc:get_event_debts": {
      data: [{ debtor: ids.ana, creditor: ids.luis, amount: 15 }],
    },
    events: { data: { status: "published" } },
    ...overrides,
  };
  const fake = fakeSupabase((call: Call) => tables[call.table] ?? {});
  mocks.session.mockResolvedValue({
    supabase: fake.client,
    user: { id: user },
  });
  return fake;
}

beforeEach(() => vi.resetAllMocks());

describe("getExpenses", () => {
  it("arma totales, saldos y deudas desde la vista de quien consulta", async () => {
    db(ids.ana);
    const result = await getExpenses(ids.group, ids.event);
    expect(result.totalCents).toBe(4250);
    expect(result.perPersonCents).toBe(1417);
    expect(result.myBalanceCents).toBe(-1500);
    expect(result.open).toBe(true);
    expect(result.members.map((m) => m.name)).toEqual(["Tú", "Luis", "Sofía"]);
    expect(result.balances).toEqual([
      { id: ids.luis, name: "Luis", cents: 1500 },
      { id: ids.ana, name: "Tú", cents: -1500 },
    ]);
    expect(result.debts).toEqual([
      {
        debtor: ids.ana,
        creditor: ids.luis,
        debtorName: "Tú",
        creditorName: "Luis",
        cents: 1500,
        canSettle: true,
        mine: true,
      },
    ]);
    expect(result.expenses).toEqual([
      expect.objectContaining({
        id: "e1",
        payer: "Luis",
        people: 2,
        canDelete: false,
      }),
      expect.objectContaining({
        id: "e2",
        payer: "Ex miembro",
        cents: 1250,
        canDelete: true,
      }),
    ]);
  });

  it("un admin puede saldar y borrar todo; una salida cancelada se cierra", async () => {
    db(ids.sofia, { events: { data: { status: "cancelled" } } });
    const result = await getExpenses(ids.group, ids.event);
    expect(result.open).toBe(false);
    expect(result.debts[0]).toMatchObject({ canSettle: true, mine: false });
    expect(result.expenses.every((e) => e.canDelete)).toBe(true);
  });

  it("quien no está en la deuda no puede saldarla", async () => {
    const others = members.map((m) => ({ ...m, role: "member" }));
    db(ids.sofia, { group_members: { data: others } });
    const result = await getExpenses(ids.group, ids.event);
    expect(result.debts[0].canSettle).toBe(false);
    expect(result.myBalanceCents).toBe(0);
  });

  it("sin gastos el promedio es cero", async () => {
    db(ids.ana, { expenses: { data: [] } });
    const result = await getExpenses(ids.group, ids.event);
    expect(result.totalCents).toBe(0);
    expect(result.perPersonCents).toBe(0);
  });

  it("falla si alguna consulta falla", async () => {
    db(ids.ana, { "rpc:get_event_debts": { error: { code: "42501" } } });
    await expect(getExpenses(ids.group, ids.event)).rejects.toThrow(
      "No se pudieron cargar los gastos.",
    );
  });
});

describe("getExpenseSummary", () => {
  it("suma el total y lo reparte entre participantes distintos", async () => {
    db(ids.ana);
    expect(await getExpenseSummary(ids.group, ids.event)).toEqual({
      totalCents: 4250,
      perPersonCents: 1417,
      count: 2,
    });
  });

  it("sin gastos devuelve ceros y falla con error de la base", async () => {
    db(ids.ana, { expenses: { data: [] } });
    expect(await getExpenseSummary(ids.group, ids.event)).toEqual({
      totalCents: 0,
      perPersonCents: 0,
      count: 0,
    });
    db(ids.ana, { expenses: { error: { code: "XX000" } } });
    await expect(getExpenseSummary(ids.group, ids.event)).rejects.toThrow();
  });
});
