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
