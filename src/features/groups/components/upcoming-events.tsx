import Link from "next/link";
import { requireUser } from "@/features/auth";
import { respond } from "@/features/rsvp";
import { dateLabel } from "@/shared/lib/utils";
import { ActionForm } from "@/shared/ui/action-form";
import styles from "./upcoming-events.module.css";

const responses = [
  { value: "going", label: "Voy" },
  { value: "maybe", label: "Quizás" },
  { value: "declined", label: "No voy" },
] as const;

export async function UpcomingEvents() {
  const { supabase, user } = await requireUser("/groups");
  const { data: events, error } = await supabase
    .from("events")
    .select("id, group_id, title, starts_at, location, groups(name)")
    .eq("status", "published")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(6);
  if (error) throw new Error("No se pudieron cargar las próximas salidas.");

  const { data: attendance, error: attendanceError } = events.length
    ? await supabase
        .from("event_attendance")
        .select("event_id, status")
        .eq("user_id", user.id)
        .in(
          "event_id",
          events.map((event) => event.id),
        )
    : { data: [], error: null };
  if (attendanceError) throw new Error("No se pudieron cargar tus respuestas.");

  return (
    <section className={styles.section} aria-labelledby="upcoming-title">
      <div className="section-heading">
        <h2 id="upcoming-title">Próximas salidas</h2>
      </div>
      {events.length ? (
        <div className={styles.list}>
          {events.map((event) => {
            const current = attendance.find(
              (item) => item.event_id === event.id,
            )?.status;
            return (
              <article className={styles.event} key={event.id}>
                <div>
                  <p className={styles.group}>{event.groups?.name}</p>
                  <h3>
                    <Link href={`/groups/${event.group_id}/events/${event.id}`}>
                      {event.title}
                    </Link>
                  </h3>
                  <p className="small muted">
                    {dateLabel(event.starts_at)}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                  <p className="small muted">
                    {current
                      ? `Tu respuesta: ${responses.find((item) => item.value === current)?.label}`
                      : "Aún no has respondido"}
                  </p>
                </div>
                <div
                  className={styles.responses}
                  role="group"
                  aria-label={`Confirmar asistencia a ${event.title}`}
                >
                  {responses.map((response) => (
                    <ActionForm
                      key={response.value}
                      action={respond}
                      label={response.label}
                      className={styles.response}
                      disabled={current === response.value}
                    >
                      <input
                        type="hidden"
                        name="group_id"
                        value={event.group_id}
                      />
                      <input type="hidden" name="event_id" value={event.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={response.value}
                      />
                    </ActionForm>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="muted">
          No hay salidas próximas publicadas en tus grupos.
        </p>
      )}
    </section>
  );
}
