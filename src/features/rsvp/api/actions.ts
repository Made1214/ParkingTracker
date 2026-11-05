"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { text, databaseError, type ActionState } from "@/shared/lib/forms";
export async function respond(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const parsed = z
    .object({
      group_id: z.uuid(),
      event_id: z.uuid(),
      status: z.enum(["going", "maybe", "declined"]),
    })
    .safeParse({
      group_id: text(form, "group_id"),
      event_id: text(form, "event_id"),
      status: text(form, "status"),
    });
  if (!parsed.success) return { error: "La respuesta no es válida." };
  const { error } = await supabase.from("event_attendance").upsert(
    {
      ...parsed.data,
      user_id: user.id,
      responded_at: new Date().toISOString(),
    },
    { onConflict: "event_id,user_id" },
  );
  if (error) return { error: databaseError(error.code) };
  revalidatePath(
    `/groups/${parsed.data.group_id}/events/${parsed.data.event_id}`,
  );
  return { success: "Tu respuesta quedó guardada." };
}
