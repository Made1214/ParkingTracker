import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fakeSupabase,
  formData,
  ids,
  op,
  type Result,
} from "@/test/fake-supabase";

const mocks = vi.hoisted(() => ({ session: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { createExpense, deleteExpense, settleDebt } from "./actions";

const path = `/groups/${ids.group}/events/${ids.event}`;
function db(result: Result = {}) {
  const fake = fakeSupabase(() => result);
  mocks.session.mockResolvedValue({
    supabase: fake.client,
    user: { id: ids.ana },
  });
  return fake;
}
const expenseForm = (extra: Record<string, string | string[]> = {}) =>
  formData({
    group_id: ids.group,
    event_id: ids.event,
    paid_by: ids.luis,
    description: "Supermercado",
    amount: "30",
    category: "comida",
    participants: [ids.ana, ids.luis, ids.sofia],
    ...extra,
  });

beforeEach(() => vi.resetAllMocks());

describe("createExpense", () => {
  it("registra el gasto en una sola transacción con su reparto", async () => {
    const fake = db();
    const key = "40000000-0000-4000-8000-000000000004";
    const result = await createExpense(
      {},
      expenseForm({ idempotency_key: key }),
    );
    expect(result).toEqual({ success: "Gasto registrado." });
    expect(op(fake.to("rpc:create_expense")[0], "rpc")?.[0]).toEqual({
      p_event_id: ids.event,
      p_description: "Supermercado",
      p_amount: 30,
      p_paid_by: ids.luis,
      p_category: "comida",
      p_shares: [
        { user_id: ids.ana, amount: 10 },
        { user_id: ids.luis, amount: 10 },
        { user_id: ids.sofia, amount: 10 },
      ],
      p_idempotency_key: key,
    });
    expect(mocks.revalidate).toHaveBeenCalledWith(path);
  });

  it("envía null como clave si el formulario no trae una", async () => {
    const fake = db();
    await createExpense({}, expenseForm());
    expect(
      (
        op(fake.to("rpc:create_expense")[0], "rpc")?.[0] as Record<
          string,
          unknown
        >
      ).p_idempotency_key,
    ).toBeNull();
  });

  it("no toca la base si el formulario no es válido", async () => {
    const result = await createExpense({}, expenseForm({ amount: "0" }));
    expect(result).toEqual({ error: "Escribe un monto mayor que cero." });
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it("traduce los errores de la base", async () => {
    db({ error: { code: "P0001", message: "event is cancelled" } });
    expect(await createExpense({}, expenseForm())).toEqual({
      error: "La salida está cancelada: ya no admite gastos.",
    });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

describe("deleteExpense", () => {
  const form = (id = ids.item) =>
    formData({ id, group_id: ids.group, event_id: ids.event });

  it("borra el gasto dentro de su grupo y salida", async () => {
    const fake = db({ data: [{ id: ids.item }] });
    expect(await deleteExpense({}, form())).toEqual({
      success: "Gasto eliminado.",
    });
    const call = fake.to("expenses")[0];
    expect(call.ops.filter(([n]) => n === "eq").map(([, a]) => a)).toEqual([
      ["id", ids.item],
      ["group_id", ids.group],
      ["event_id", ids.event],
    ]);
    expect(mocks.revalidate).toHaveBeenCalledWith(path);
  });

  it("avisa si RLS no dejó borrar nada", async () => {
    db({ data: [] });
    expect(await deleteExpense({}, form())).toEqual({
      error: "Solo quien lo registró o un admin puede borrarlo.",
    });
  });

  it("rechaza ids inválidos y errores de permisos", async () => {
    expect(await deleteExpense({}, form("x"))).toEqual({
      error: "El gasto no es válido.",
    });
    db({ error: { code: "42501" } });
    expect(await deleteExpense({}, form())).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
  });
});

describe("settleDebt", () => {
  const form = (debtor = ids.ana) =>
    formData({
      group_id: ids.group,
      event_id: ids.event,
      debtor,
      creditor: ids.luis,
    });

  it("salda la deuda de la salida", async () => {
    const fake = db();
    expect(await settleDebt({}, form())).toEqual({
      success: "Marcado como saldado.",
    });
    expect(op(fake.to("rpc:settle_event_debt")[0], "rpc")?.[0]).toEqual({
      p_event_id: ids.event,
      p_debtor: ids.ana,
      p_creditor: ids.luis,
    });
  });

  it("valida las personas y propaga errores", async () => {
    expect(await settleDebt({}, form("nadie"))).toEqual({
      error: "La deuda no es válida.",
    });
    db({ error: { code: "42501" } });
    expect(await settleDebt({}, form())).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
  });
});
