import Link from "next/link";
import { ArrowUpRight, MapPin, CalendarDays, Clock } from "lucide-react";
import { dateLabel } from "@/shared/lib/utils";
import type { listEvents } from "../api/queries";
export const statusLabels = {
  draft: "Borrador",
  published: "Se viene",
  cancelled: "Cancelado",
  finished: "Finalizado",
};
type EventSummary = Awaited<ReturnType<typeof listEvents>>[number];

/** Una página de salidas, ya ordenada por la consulta. */
export function EventList({
  groupId,
  events,
  tab = "proximas",
}: {
  groupId: string;
  events: EventSummary[];
  tab?: "proximas" | "pasadas";
}) {
  if (!events.length)
    return tab === "pasadas" ? (
      <div className="card empty-state">
        <CalendarDays size={30} />
        <h3>Todavía no hay historia.</h3>
        <p className="muted">
          Las salidas terminadas o canceladas aparecerán aquí.
        </p>
      </div>
    ) : (
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
      {events.map((event, index) => (
        <Link
          className="event-card"
          key={event.id}
          href={`/groups/${groupId}/events/${event.id}`}
          style={{ animationDelay: `${index * 55}ms` }}
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
            <div className="event-meta-top">
              <span className={`badge badge-${event.status}`}>
                {event.status === "published" && (
                  <span className="status-beacon" aria-hidden="true" />
                )}
                {statusLabels[event.status]}
              </span>
              <span className="event-time">
                <Clock size={12} />
                {dateLabel(event.starts_at)}
              </span>
            </div>
            <h3>{event.title}</h3>
            {event.location ? (
              <p className="small muted location">
                <MapPin size={13} />
                <span>{event.location}</span>
              </p>
            ) : (
              <p className="small muted">Ubicación por definir</p>
            )}
          </div>
          <span className="event-arrow-pill" aria-hidden="true">
            <ArrowUpRight className="event-arrow" size={18} />
          </span>
        </Link>
      ))}
    </div>
  );
}
