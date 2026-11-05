"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { databaseError, text, type ActionState } from "@/shared/lib/forms";

const ids = z.object({ group_id: z.uuid(), event_id: z.uuid() });
const status = z.enum(["pending", "in_progress", "done"]);

async function context(form: FormData) {
  const parsed = ids.safeParse({
    group_id: text(form, "group_id"),
    event_id: text(form, "event_id"),
  });
  if (!parsed.success) return null;
  const { supabase, user } = await requireUser();
  const { data: event, error } = await supabase
    .from("events")
    .select("status")
    .eq("group_id", parsed.data.group_id)
    .eq("id", parsed.data.event_id)
    .maybeSingle();
  if (
    error ||
    !event ||
    event.status === "finished" ||
    event.status === "cancelled"
  )
    return null;
  return { ...parsed.data, supabase, user };
}

async function validAssignee(
  ctx: NonNullable<Awaited<ReturnType<typeof context>>>,
  assignee: string,
) {
  if (!assignee) return true;
  if (!z.uuid().safeParse(assignee).success) return false;
  const { data, error } = await ctx.supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", ctx.group_id)
    .eq("user_id", assignee)
    .maybeSingle();
  return !error && !!data;
}

export async function createTask(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await context(form);
  const title = z
    .string()
    .trim()
    .min(1)
    .max(120)
    .safeParse(text(form, "title"));
  const assignee = text(form, "assignee_id");
  if (!ctx || !title.success || !(await validAssignee(ctx, assignee)))
    return { error: "Revisa el título, el evento y la persona asignada." };
  const { error } = await ctx.supabase.from("tasks").insert({
    group_id: ctx.group_id,
    event_id: ctx.event_id,
    title: title.data,
    assignee_id: assignee || null,
    created_by: ctx.user.id,
  });
  if (error) return { error: databaseError(error.code) };
  revalidatePath(`/groups/${ctx.group_id}/events/${ctx.event_id}`);
  return { success: "Tarea creada." };
}

export async function updateTask(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await context(form);
  const taskId = z.uuid().safeParse(text(form, "task_id"));
  const nextStatus = status.safeParse(text(form, "status"));
  const assignee = text(form, "assignee_id");
  if (
    !ctx ||
    !taskId.success ||
    !nextStatus.success ||
    !(await validAssignee(ctx, assignee))
  )
    return { error: "Revisa los datos de la tarea." };
  const { data, error } = await ctx.supabase
    .from("tasks")
    .update({ status: nextStatus.data, assignee_id: assignee || null })
    .eq("id", taskId.data)
    .eq("group_id", ctx.group_id)
    .eq("event_id", ctx.event_id)
    .select("id")
    .maybeSingle();
  if (error) return { error: databaseError(error.code) };
  if (!data)
    return {
      error: "No tienes permiso para actualizar esta tarea o ya no existe.",
    };
  revalidatePath(`/groups/${ctx.group_id}/events/${ctx.event_id}`);
  return { success: "Tarea actualizada." };
}
