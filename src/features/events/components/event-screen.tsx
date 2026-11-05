import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, AlignLeft } from "lucide-react";
import { AttendancePanel } from "@/features/rsvp";
import { ProposalsPanel } from "@/features/proposals";
import { Card } from "@/shared/ui/card";
import { dateLabel } from "@/shared/lib/utils";
import { getEvent } from "../api/queries";
import { statusLabels } from "./event-list";
export async function EventScreen({
  groupId,
  eventId,
}: {
  groupId: string;
  eventId: string;
}) {
  const { event, user, canRespond } = await getEvent(groupId, eventId);
  const monthLabel = new Intl.DateTimeFormat("es", {
    month: "short",
    timeZone: "America/Panama",
  }).format(new Date(event.starts_at));
  const dayLabel = new Intl.DateTimeFormat("es", {
    day: "2-digit",
    timeZone: "America/Panama",
  }).format(new Date(event.starts_at));

  return (
    <>
      <Link className="back-link" href={`/groups/${groupId}`}>
        <ArrowLeft size={16} /> Volver al grupo
      </Link>
      <div className="event-hero">
        <div className="event-hero-main">
          <div className="event-hero-badges">
            <span className={`badge badge-${event.status}`}>
              {event.status === "published" && (
                <span className="status-beacon" aria-hidden="true" />
              )}
              {statusLabels[event.status]}
            </span>
            <span className="event-tz-pill">Hora de Panamá (UTC−5)</span>
          </div>
          <h1>{event.title}</h1>
          <p className="muted">La fecha está puesta. Ahora falta tu gente.</p>
        </div>
        <div className="date-tile date-tile-lg" aria-hidden="true">
          <span>{monthLabel}</span>
          <strong>{dayLabel}</strong>
        </div>
      </div>
      <div className="content-columns event-detail-columns">
        <Card className="event-details-card">
          <h2>Todo lo que necesitas saber</h2>
          <div className="detail-grid">
            <div className="detail-line">
              <span className="detail-icon">
                <CalendarDays size={19} />
              </span>
              <div>
                <span className="detail-label">Cuándo</span>
                <strong>{dateLabel(event.starts_at)}</strong>
                <p className="small muted">
                  Hasta {dateLabel(event.ends_at)} · hora de Panamá
                </p>
              </div>
            </div>
            <div className="detail-line">
              <span className="detail-icon">
                <MapPin size={19} />
              </span>
              <div>
                <span className="detail-label">Dónde</span>
                <strong>{event.location || "Ubicación por confirmar"}</strong>
                <p className="small muted">
                  {event.location
                    ? "Punto de encuentro del grupo"
                    : "Se avisará en el grupo"}
                </p>
              </div>
            </div>
          </div>
          <div className="description-block">
            <div className="description-header">
              <AlignLeft size={15} />
              <span>Notas y detalles del plan</span>
            </div>
            <p className="description">
              {event.description ||
                "Sin notas adicionales por ahora. ¡Solo confirma tu asistencia y nos vemos allá!"}
            </p>
          </div>
        </Card>
        <AttendancePanel
          groupId={groupId}
          eventId={eventId}
          userId={user.id}
          open={canRespond}
        />
      </div>
      <ProposalsPanel
        groupId={groupId}
        eventId={eventId}
        open={event.status !== "finished" && event.status !== "cancelled"}
      />
    </>
  );
}
