"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { databaseError, text, type ActionState } from "@/shared/lib/forms";

export async function createProposal(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const parsed = z
    .object({
      group_id: z.uuid(),
      event_id: z.uuid(),
      title: z.string().min(1).max(120),
      description: z.string().max(2000),
    })
    .safeParse({
      group_id: text(form, "group_id"),
      event_id: text(form, "event_id"),
      title: text(form, "title"),
      description: text(form, "description"),
    });
  if (!parsed.success)
    return {
      error:
        "Escribe un título de hasta 120 caracteres y una descripción de hasta 2000 caracteres.",
    };
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("status")
    .eq("id", parsed.data.event_id)
    .eq("group_id", parsed.data.group_id)
    .maybeSingle();
  if (
    eventError ||
    !event ||
    event.status === "finished" ||
    event.status === "cancelled"
  )
    return { error: "No se pueden a?adir propuestas a este evento." };
  const { error } = await supabase.from("activity_proposals").insert({
    ...parsed.data,
    description: parsed.data.description || null,
    created_by: user.id,
  });
  if (error) return { error: databaseError(error.code) };
  revalidatePath(
    `/groups/${parsed.data.group_id}/events/${parsed.data.event_id}`,
  );
  return { success: "Tu propuesta quedó publicada." };
}
