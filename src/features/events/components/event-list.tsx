import Link from "next/link";
import { ArrowUpRight, MapPin, CalendarDays } from "lucide-react";
import { dateLabel } from "@/shared/lib/utils";
import { listEvents } from "../api/queries";
export const statusLabels = {
  draft: "Borrador",
  published: "Se viene",
  cancelled: "Cancelado",
  finished: "Finalizado",
};
export async function EventList({ groupId }: { groupId: string }) {
  const events = await listEvents(groupId);
  if (!events.length)
    return (
      <div className="card empty-state">
        <CalendarDays size={30} />
        <h3>El próximo plan puede ser tuyo.</h3>
        <p className="muted">
          Publica el primer evento y deja que el grupo se sume.
        </p>
      </div>
    );
  return (
    <div className="event-list">
      {events.map((event) => (
        <Link
          className="event-card"
          key={event.id}
          href={`/groups/${groupId}/events/${event.id}`}
        >
          <div className="date-tile">
            <span>
              {new Intl.DateTimeFormat("es", {
                month: "short",
                timeZone: "America/Panama",
              }).format(new Date(event.starts_at))}
            </span>
            <strong>
              {new Intl.DateTimeFormat("es", {
                day: "2-digit",
                timeZone: "America/Panama",
              }).format(new Date(event.starts_at))}
            </strong>
          </div>
          <div className="event-info">
            <span className={`badge badge-${event.status}`}>
              {statusLabels[event.status]}
            </span>
            <h3>{event.title}</h3>
            <p className="small muted">{dateLabel(event.starts_at)}</p>
            {event.location && (
              <p className="small muted location">
                <MapPin size={13} />
                {event.location}
              </p>
            )}
          </div>
          <ArrowUpRight className="event-arrow" size={21} />
        </Link>
      ))}
    </div>
  );
}
