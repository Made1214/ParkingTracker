import { z } from "zod";
import { text } from "@/shared/lib/forms";
import { fromPanamaInput } from "@/shared/lib/utils";

const ids = z.object({ group_id: z.uuid(), event_id: z.uuid() });
const item = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
});

export type ScheduleInput = {
  group_id: string;
  event_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  proposal_id: string | null;
};

/** Valida el formulario de una actividad; las horas llegan en hora de Panamá. */
export function parseScheduleForm(
  form: FormData,
): { data: ScheduleInput } | { error: string } {
  const parsedIds = ids.safeParse({
    group_id: text(form, "group_id"),
    event_id: text(form, "event_id"),
  });
  const parsedItem = item.safeParse({
    title: text(form, "title"),
    description: text(form, "description"),
  });
  if (!parsedIds.success || !parsedItem.success)
    return { error: "Escribe un título de hasta 120 caracteres." };
  const startsAt = fromPanamaInput(text(form, "starts_at"));
  if (!startsAt) return { error: "Indica la hora de inicio." };
  const endInput = text(form, "ends_at");
  const endsAt = endInput ? fromPanamaInput(endInput) : null;
  if (endInput && !endsAt) return { error: "La hora de fin no es válida." };
  if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt))
    return { error: "La actividad debe terminar después de empezar." };
  const proposal = text(form, "proposal_id");
  if (proposal && !z.uuid().safeParse(proposal).success)
    return { error: "La propuesta no es válida." };
  return {
    data: {
      ...parsedIds.data,
      title: parsedItem.data.title,
      description: parsedItem.data.description || null,
      starts_at: startsAt,
      ends_at: endsAt,
      proposal_id: proposal || null,
    },
  };
}

/** Traduce los errores de la base de datos del cronograma a mensajes claros. */
export function scheduleError(code?: string, message?: string) {
  if (code === "23514" && message?.includes("within the event"))
    return "La actividad debe quedar dentro del horario de la salida.";
  if (code === "23514" && message?.includes("accepted proposals"))
    return "Solo puedes agendar propuestas aprobadas de esta salida.";
  if (code === "23505") return "Esa propuesta ya está en el cronograma.";
  if (code === "42501")
    return "Solo quien organiza la salida o un admin puede cambiar el cronograma.";
  return "No se pudo guardar. Inténtalo de nuevo.";
}
