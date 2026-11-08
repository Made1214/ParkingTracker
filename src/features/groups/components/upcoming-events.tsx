import { requireUser } from "@/features/auth";
import { respond } from "@/features/rsvp";
import { dateLabel } from "@/shared/lib/utils";
import { UpcomingEventCard } from "./upcoming-event-card";
import styles from "./upcoming-events.module.css";

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
              <UpcomingEventCard
                key={event.id}
                eventId={event.id}
                groupId={event.group_id}
                title={event.title}
                groupName={event.groups?.name ?? ""}
                date={dateLabel(event.starts_at)}
                location={event.location}
                current={current}
                respond={respond}
              />
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
