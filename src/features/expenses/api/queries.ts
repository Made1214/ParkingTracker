import "server-only";
import { requireUser } from "@/features/auth";
import { toCents } from "./expense-form";

const cents = (value: number) => toCents(Number(value).toFixed(2)) ?? 0;

export async function getExpenses(groupId: string, eventId: string) {
  const { supabase, user } = await requireUser(
    `/groups/${groupId}/events/${eventId}`,
  );
  const [members, expenses, balances, debts, event] = await Promise.all([
    supabase
      .from("group_members")
      .select("user_id, role, profiles(display_name)")
      .eq("group_id", groupId),
    supabase
      .from("expenses")
      .select(
        "id, description, amount, category, paid_by, created_by, created_at, expense_splits(user_id, share_amount, settled)",
      )
      .eq("group_id", groupId)
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_event_balances", { p_event_id: eventId }),
    supabase.rpc("get_event_debts", { p_event_id: eventId }),
    supabase
      .from("events")
      .select("status")
      .eq("group_id", groupId)
      .eq("id", eventId)
      .single(),
  ]);
  if (
    members.error ||
    expenses.error ||
    balances.error ||
    debts.error ||
    event.error
  )
    throw new Error("No se pudieron cargar los gastos.");

  const names = new Map(
    members.data.map((m) => [
      m.user_id,
      m.user_id === user.id ? "Tú" : (m.profiles?.display_name ?? "Miembro"),
    ]),
  );
  const name = (id: string) => names.get(id) ?? "Ex miembro";
  const isAdmin = members.data.some(
    (m) => m.user_id === user.id && m.role === "admin",
  );
  const totalCents = expenses.data.reduce((sum, e) => sum + cents(e.amount), 0);
  const participants = new Set(
    expenses.data.flatMap((e) => e.expense_splits.map((s) => s.user_id)),
  );
  const myBalance =
    balances.data.find((b) => b.user_id === user.id)?.net_amount ?? 0;

  return {
    userId: user.id,
    open: event.data.status !== "cancelled",
    members: members.data
      .map((m) => ({ id: m.user_id, name: name(m.user_id) }))
      .sort((a, b) =>
        a.id === user.id
          ? -1
          : b.id === user.id
            ? 1
            : a.name.localeCompare(b.name),
      ),
    totalCents,
    perPersonCents: participants.size
      ? Math.round(totalCents / participants.size)
      : 0,
    myBalanceCents: cents(myBalance),
    balances: balances.data
      .map((b) => ({
        id: b.user_id,
        name: name(b.user_id),
        cents: cents(b.net_amount),
      }))
      .filter((b) => b.cents !== 0)
      .sort((a, b) => b.cents - a.cents),
    debts: debts.data.map((d) => ({
      debtor: d.debtor,
      creditor: d.creditor,
      debtorName: name(d.debtor),
      creditorName: name(d.creditor),
      cents: cents(d.amount),
      canSettle: isAdmin || d.debtor === user.id || d.creditor === user.id,
      mine: d.debtor === user.id,
    })),
    expenses: expenses.data.map((e) => ({
      id: e.id,
      description: e.description,
      category: e.category,
      cents: cents(e.amount),
      payer: name(e.paid_by),
      people: e.expense_splits.length,
      canDelete: isAdmin || e.created_by === user.id,
    })),
  };
}
