"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { databaseError, text, type ActionState } from "@/shared/lib/forms";
import { fromPanamaInput as parsePanamaDateTime } from "@/shared/lib/utils";

const ids = z.object({ group_id: z.guid(), event_id: z.guid() });
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
    .select("status, ends_at")
    .eq("group_id", parsed.data.group_id)
    .eq("id", parsed.data.event_id)
    .maybeSingle();
  if (
    error ||
    !event ||
    event.status !== "published" ||
    Date.parse(event.ends_at) <= Date.now()
  )
    return null;
  return { ...parsed.data, ends_at: event.ends_at, supabase, user };
}

async function validAssignee(
  ctx: NonNullable<Awaited<ReturnType<typeof context>>>,
  assignee: string,
) {
  if (!assignee) return true;
  if (!z.guid().safeParse(assignee).success) return false;
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

  const rawDueAt = text(form, "due_at");
  let dueAtIso: string | null = null;
  if (rawDueAt) {
    const parsed = parsePanamaDateTime(rawDueAt);
    if (
      !parsed ||
      Number.isNaN(Date.parse(parsed)) ||
      Date.parse(parsed) > Date.parse(ctx.ends_at)
    ) {
      return {
        error: "La fecha límite no puede ser posterior al final de la salida.",
      };
    }
    dueAtIso = parsed;
  }

  const { error } = await ctx.supabase.from("tasks").insert({
    group_id: ctx.group_id,
    event_id: ctx.event_id,
    title: title.data,
    assignee_id: assignee || null,
    due_at: dueAtIso,
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
  const taskId = z.guid().safeParse(text(form, "task_id"));
  const nextStatus = status.safeParse(text(form, "status"));
  const assignee = text(form, "assignee_id");
  if (
    !ctx ||
    !taskId.success ||
    !nextStatus.success ||
    !(await validAssignee(ctx, assignee))
  )
    return { error: "Revisa los datos de la tarea." };

  const payload: {
    status: "pending" | "in_progress" | "done";
    assignee_id: string | null;
    due_at?: string | null;
  } = {
    status: nextStatus.data,
    assignee_id: assignee || null,
  };

  if (form.has("due_at")) {
    const rawDueAt = text(form, "due_at");
    if (rawDueAt) {
      const parsed = parsePanamaDateTime(rawDueAt);
      if (
        !parsed ||
        Number.isNaN(Date.parse(parsed)) ||
        Date.parse(parsed) > Date.parse(ctx.ends_at)
      ) {
        return {
          error: "La fecha límite no puede ser posterior al final de la salida.",
        };
      }
      payload.due_at = parsed;
    } else {
      payload.due_at = null;
    }
  }

  const { data, error } = await ctx.supabase
    .from("tasks")
    .update(payload)
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
