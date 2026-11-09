"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { text, type ActionState } from "@/shared/lib/forms";
import { expenseError, parseExpenseForm } from "./expense-form";

const eventPath = (groupId: string, eventId: string) =>
  `/groups/${groupId}/events/${eventId}`;

export async function createExpense(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = parseExpenseForm(form);
  if ("error" in parsed) return parsed;
  const { supabase } = await requireUser();
  const { group_id, event_id, ...expense } = parsed.data;
  const { error } = await supabase.rpc("create_expense", {
    p_event_id: event_id,
    p_description: expense.description,
    p_amount: expense.amount,
    p_paid_by: expense.paid_by,
    p_category: expense.category,
    p_shares: expense.shares,
  });
  if (error) return { error: expenseError(error.code, error.message) };
  revalidatePath(eventPath(group_id, event_id));
  return { success: "Gasto registrado." };
}

const refs = z.object({
  group_id: z.uuid(),
  event_id: z.uuid(),
});

export async function deleteExpense(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ids = refs.extend({ id: z.uuid() }).safeParse({
    id: text(form, "id"),
    group_id: text(form, "group_id"),
    event_id: text(form, "event_id"),
  });
  if (!ids.success) return { error: "El gasto no es válido." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", ids.data.id)
    .eq("group_id", ids.data.group_id)
    .eq("event_id", ids.data.event_id)
    .select("id");
  if (error) return { error: expenseError(error.code, error.message) };
  if (!data.length)
    return { error: "Solo quien lo registró o un admin puede borrarlo." };
  revalidatePath(eventPath(ids.data.group_id, ids.data.event_id));
  return { success: "Gasto eliminado." };
}

export async function settleDebt(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ids = refs.extend({ debtor: z.uuid(), creditor: z.uuid() }).safeParse({
    group_id: text(form, "group_id"),
    event_id: text(form, "event_id"),
    debtor: text(form, "debtor"),
    creditor: text(form, "creditor"),
  });
  if (!ids.success) return { error: "La deuda no es válida." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("settle_event_debt", {
    p_event_id: ids.data.event_id,
    p_debtor: ids.data.debtor,
    p_creditor: ids.data.creditor,
  });
  if (error) return { error: expenseError(error.code, error.message) };
  revalidatePath(eventPath(ids.data.group_id, ids.data.event_id));
  return { success: "Marcado como saldado." };
}
