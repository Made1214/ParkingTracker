import { Card } from "@/shared/ui/card";
import { ActionForm } from "@/shared/ui/action-form";
import { getAttendance } from "../api/queries";
import { respond } from "../api/actions";
const options = [
  { value: "going", label: "Voy", icon: "✓" },
  { value: "maybe", label: "Quizás", icon: "?" },
  { value: "declined", label: "No voy", icon: "−" },
] as const;
export async function AttendancePanel({
  groupId,
  eventId,
  userId,
  open,
}: {
  groupId: string;
  eventId: string;
  userId: string;
  open: boolean;
}) {
  const attendance = await getAttendance(groupId, eventId);
  const own = attendance.find((row) => row.user_id === userId);
  const total = attendance.length;
  const goingCount = attendance.filter((r) => r.status === "going").length;
  const maybeCount = attendance.filter((r) => r.status === "maybe").length;
  const declinedCount = attendance.filter(
    (r) => r.status === "declined",
  ).length;

  return (
    <Card className="attendance-card">
      <div className="attendance-header">
        <div>
          <span className="eyebrow">CONTAMOS CONTIGO</span>
          <h2>¿Te sumas?</h2>
        </div>
        {own && (
          <span
            key={own.status}
            className={`rsvp-current-pill status-${own.status}`}
            role="status"
          >
            Tu respuesta:{" "}
            <strong>
              {options.find((option) => option.value === own.status)?.label}
            </strong>
          </span>
        )}
      </div>
      <p className="muted small">
        {open
          ? "Puedes cambiar tu respuesta hasta que empiece el evento."
          : "Las confirmaciones de este evento están cerradas."}
      </p>
      <div
        className="rsvp-options"
        role="group"
        aria-label="Confirmar asistencia"
      >
        {options.map((option) => (
          <ActionForm
            key={option.value}
            action={respond}
            label={`${option.icon} ${option.label}`}
            disabled={!open}
            className={`rsvp-form rsvp-${option.value} ${own?.status === option.value ? "selected" : ""}`}
          >
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="status" value={option.value} />
          </ActionForm>
        ))}
      </div>
      {total > 0 && (
        <div className="rsvp-meter-wrap" aria-hidden="true">
          <div className="rsvp-meter">
            <span
              className="meter-seg seg-going"
              style={{ width: `${(goingCount / total) * 100}%` }}
            />
            <span
              className="meter-seg seg-maybe"
              style={{ width: `${(maybeCount / total) * 100}%` }}
            />
            <span
              className="meter-seg seg-declined"
              style={{ width: `${(declinedCount / total) * 100}%` }}
            />
          </div>
          <div className="rsvp-meter-caption">
            <span>
              {goingCount} {goingCount === 1 ? "confirmado" : "confirmados"}
            </span>
            <span>
              {total} {total === 1 ? "respuesta" : "respuestas"}
            </span>
          </div>
        </div>
      )}
      <hr />
      <div className="attendance-breakdown">
        {options.map((option) => {
          const people = attendance.filter(
            (row) => row.status === option.value,
          );
          return (
            <div
              className={`attendance-group group-${option.value} ${people.length ? "has-people" : ""}`}
              key={option.value}
            >
              <div className="attendance-group-header">
                <h3>
                  <span className="group-status-dot" aria-hidden="true" />
                  {option.label}
                </h3>
                <span className="count">{people.length}</span>
              </div>
              {people.length ? (
                <div className="attendee-chips">
                  {people.map((row, idx) => {
                    const displayName = row.profiles?.display_name ?? "Miembro";
                    return (
                      <span
                        className="attendee-chip"
                        key={row.user_id}
                        style={{ animationDelay: `${idx * 45}ms` }}
                      >
                        <span className="attendee-avatar" aria-hidden="true">
                          {displayName.slice(0, 1).toUpperCase()}
                        </span>
                        <span>{displayName}</span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="small muted">Aún sin respuestas</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
