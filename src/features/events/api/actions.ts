"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { text, databaseError, type ActionState } from "@/shared/lib/forms";
export async function createEvent(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const parsed = z
    .object({
      group_id: z.uuid(),
      title: z.string().min(1).max(120),
      description: z.string().max(5000),
      location: z.string().max(200),
      starts_at: z.iso.datetime({ offset: true }),
      ends_at: z.iso.datetime({ offset: true }),
    })
    .safeParse(
      Object.fromEntries(
        [
          "group_id",
          "title",
          "description",
          "location",
          "starts_at",
          "ends_at",
        ].map((key) => [key, text(form, key)]),
      ),
    );
  if (!parsed.success)
    return { error: "Revisa el título, el grupo y las fechas del evento." };
  if (
    Date.parse(parsed.data.ends_at) <= Date.parse(parsed.data.starts_at) ||
    Date.parse(parsed.data.starts_at) <= Date.now()
  )
    return { error: "El inicio debe ser futuro y el fin posterior al inicio." };
  const { data, error } = await supabase
    .from("events")
    .insert({ ...parsed.data, created_by: user.id, status: "published" })
    .select("id")
    .single();
  if (error) return { error: databaseError(error.code) };
  revalidatePath(`/groups/${parsed.data.group_id}`);
  redirect(`/groups/${parsed.data.group_id}/events/${data.id}`);
}

export async function updateEvent(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      group_id: z.uuid(),
      event_id: z.uuid(),
      title: z.string().trim().min(1).max(120),
      description: z.string().max(5000),
      location: z.string().max(200),
      starts_at: z.iso.datetime({ offset: true }),
      ends_at: z.iso.datetime({ offset: true }),
    })
    .safeParse(
      Object.fromEntries(
        [
          "group_id",
          "event_id",
          "title",
          "description",
          "location",
          "starts_at",
          "ends_at",
        ].map((key) => [key, text(form, key)]),
      ),
    );
  if (!parsed.success)
    return { error: "Revisa el título, el lugar y las fechas del evento." };
  const { group_id, event_id, ...updates } = parsed.data;
  if (
    Date.parse(updates.starts_at) <= Date.now() ||
    Date.parse(updates.ends_at) <= Date.parse(updates.starts_at)
  )
    return { error: "El inicio debe ser futuro y el fin posterior al inicio." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", event_id)
    .eq("group_id", group_id)
    .eq("status", "published")
    .gt("starts_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (error) return { error: databaseError(error.code) };
  if (!data)
    return {
      error:
        "No tienes permiso para editar este evento o ya no se puede modificar.",
    };
  revalidatePath(`/groups/${group_id}/events/${event_id}`);
  revalidatePath(`/groups/${group_id}`);
  revalidatePath("/groups");
  return { success: "Evento actualizado." };
}

export async function cancelEvent(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ids = z.object({ group_id: z.uuid(), event_id: z.uuid() }).safeParse({
    group_id: text(form, "group_id"),
    event_id: text(form, "event_id"),
  });
  if (!ids.success) return { error: "No se pudo identificar el evento." };
  const { group_id, event_id } = ids.data;
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("events")
    .update({ status: "cancelled" })
    .eq("id", event_id)
    .eq("group_id", group_id)
    .eq("status", "published")
    .gt("starts_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (error) return { error: databaseError(error.code) };
  if (!data)
    return {
      error:
        "No tienes permiso para cancelar este evento o ya no se puede cancelar.",
    };
  revalidatePath(`/groups/${group_id}/events/${event_id}`);
  revalidatePath(`/groups/${group_id}`);
  revalidatePath("/groups");
  return { success: "Evento cancelado." };
}
