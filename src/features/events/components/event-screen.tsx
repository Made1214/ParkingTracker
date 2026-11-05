import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { AttendancePanel } from "@/features/rsvp";
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
  return (
    <>
      <Link className="back-link" href={`/groups/${groupId}`}>
        <ArrowLeft size={16} /> Volver al grupo
      </Link>
      <div className="page-heading">
        <div>
          <span className={`badge badge-${event.status}`}>
            {statusLabels[event.status]}
          </span>
          <h1>{event.title}</h1>
          <p className="muted">La fecha está puesta. Ahora falta tu gente.</p>
        </div>
      </div>
      <div className="content-columns">
        <Card>
          <h2>Todo lo que necesitas saber</h2>
          <div className="detail-line">
            <CalendarDays size={21} />
            <div>
              <strong>{dateLabel(event.starts_at)}</strong>
              <p className="small muted">
                Hasta {dateLabel(event.ends_at)} · hora de Panamá
              </p>
            </div>
          </div>
          {event.location && (
            <div className="detail-line">
              <MapPin size={21} />
              <strong>{event.location}</strong>
            </div>
          )}
          {event.description && (
            <p className="description">{event.description}</p>
          )}
        </Card>
        <AttendancePanel
          groupId={groupId}
          eventId={eventId}
          userId={user.id}
          open={canRespond}
        />
      </div>
    </>
  );
}
