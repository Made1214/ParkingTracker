"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { databaseError, text, type ActionState } from "@/shared/lib/forms";

export async function createProposal(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
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
  const { error } = await supabase.rpc("create_activity_proposal", {
    p_event_id: parsed.data.event_id,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
  });
  if (error) return { error: databaseError(error.code) };
  revalidatePath(
    `/groups/${parsed.data.group_id}/events/${parsed.data.event_id}`,
  );
  return { success: "Tu propuesta quedó publicada." };
}

export async function createPoll(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const eventId = text(form, "event_id");
  const groupId = text(form, "group_id");
  const question = text(form, "question");
  const options = text(form, "options")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const closesAt = text(form, "closes_at");
  const date = new Date(`${closesAt}-05:00`);
  if (
    !z.uuid().safeParse(eventId).success ||
    !z.uuid().safeParse(groupId).success ||
    !question ||
    question.length > 200 ||
    options.length < 2 ||
    options.length > 10 ||
    options.some((x) => x.length > 100) ||
    new Set(options).size !== options.length ||
    !Number.isFinite(date.getTime()) ||
    date.getTime() <= Date.now()
  )
    return { error: "Revisa la pregunta, las opciones y la fecha de cierre." };
  const { error } = await supabase.rpc("create_poll", {
    p_event_id: eventId,
    p_question: question,
    p_options: options,
    p_allow_multiple: form.has("allow_multiple"),
    p_closes_at: date.toISOString(),
  });
  if (error) return { error: databaseError(error.code) };
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  return { success: "Votaci?n creada." };
}

export async function vote(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const pollId = text(form, "poll_id");
  const options = form.getAll("option_id").map(String);
  const groupId = text(form, "group_id");
  const eventId = text(form, "event_id");
  if (
    ![pollId, groupId, eventId, ...options].every(
      (x) => z.uuid().safeParse(x).success,
    ) ||
    !options.length
  )
    return { error: "Selecciona una opci?n v?lida." };
  const { error } = await supabase.rpc("cast_vote", {
    p_poll_id: pollId,
    p_option_ids: options,
  });
  if (error)
    return {
      error:
        error.code === "55000"
          ? "La votaci?n est? cerrada."
          : databaseError(error.code),
    };
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  return { success: "Tu voto qued? guardado." };
}

export async function closePoll(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const pollId = text(form, "poll_id"),
    groupId = text(form, "group_id"),
    eventId = text(form, "event_id");
  if (![pollId, groupId, eventId].every((x) => z.uuid().safeParse(x).success))
    return { error: "Votaci?n inv?lida." };
  const { error } = await supabase.rpc("close_poll", { p_poll_id: pollId });
  if (error) return { error: databaseError(error.code) };
  revalidatePath(`/groups/${groupId}/events/${eventId}`);
  return { success: "Votaci?n cerrada." };
}
