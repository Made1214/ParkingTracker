"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { text, type ActionState } from "@/shared/lib/forms";
import { parseScheduleForm, scheduleError } from "./schedule-form";

const eventPath = (groupId: string, eventId: string) =>
  `/groups/${groupId}/events/${eventId}`;

export async function createScheduleItem(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = parseScheduleForm(form);
  if ("error" in parsed) return parsed;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("schedule_items")
    .insert({ ...parsed.data, created_by: user.id });
  if (error) return { error: scheduleError(error.code, error.message) };
  revalidatePath(eventPath(parsed.data.group_id, parsed.data.event_id));
  return {
    success: parsed.data.proposal_id
      ? "Propuesta añadida al cronograma."
      : "Actividad añadida.",
  };
}

export async function updateScheduleItem(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = z.uuid().safeParse(text(form, "id"));
  const parsed = parseScheduleForm(form);
  if (!id.success) return { error: "La actividad no es válida." };
  if ("error" in parsed) return parsed;
  const { supabase } = await requireUser();
  const { group_id, event_id, title, description, starts_at, ends_at } =
    parsed.data;
  const { data, error } = await supabase
    .from("schedule_items")
    .update({ title, description, starts_at, ends_at })
    .eq("id", id.data)
    .eq("group_id", group_id)
    .eq("event_id", event_id)
    .select("id");
  if (error) return { error: scheduleError(error.code, error.message) };
  if (!data.length) return { error: scheduleError("42501") };
  revalidatePath(eventPath(group_id, event_id));
  return { success: "Actividad actualizada." };
}

export async function deleteScheduleItem(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ids = z
    .object({ id: z.uuid(), group_id: z.uuid(), event_id: z.uuid() })
    .safeParse({
      id: text(form, "id"),
      group_id: text(form, "group_id"),
      event_id: text(form, "event_id"),
    });
  if (!ids.success) return { error: "La actividad no es válida." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("schedule_items")
    .delete()
    .eq("id", ids.data.id)
    .eq("group_id", ids.data.group_id)
    .eq("event_id", ids.data.event_id)
    .select("id");
  if (error) return { error: scheduleError(error.code, error.message) };
  if (!data.length) return { error: scheduleError("42501") };
  revalidatePath(eventPath(ids.data.group_id, ids.data.event_id));
  return { success: "Actividad eliminada." };
}
