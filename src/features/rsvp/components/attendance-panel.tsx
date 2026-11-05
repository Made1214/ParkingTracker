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
  return (
    <Card>
      <span className="eyebrow">CONTAMOS CONTIGO</span>
      <h2>¿Te sumas?</h2>
      <p className="muted small">
        {open
          ? "Puedes cambiar tu respuesta hasta que empiece el evento."
          : "Las confirmaciones de este evento están cerradas."}
      </p>
      <div className="rsvp-options">
        {options.map((option) => (
          <ActionForm
            key={option.value}
            action={respond}
            label={`${option.icon} ${option.label}`}
            disabled={!open}
            className={`rsvp-form ${own?.status === option.value ? "selected" : ""}`}
          >
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="status" value={option.value} />
          </ActionForm>
        ))}
      </div>
      {own && (
        <p className="small" role="status">
          Tu respuesta:{" "}
          <strong>
            {options.find((option) => option.value === own.status)?.label}
          </strong>
        </p>
      )}
      <hr />
      {options.map((option) => {
        const people = attendance.filter((row) => row.status === option.value);
        return (
          <div className="attendance-group" key={option.value}>
            <h3>
              {option.label}
              <span className="count">{people.length}</span>
            </h3>
            <p className="small muted">
              {people.length
                ? people
                    .map((row) => row.profiles?.display_name ?? "Miembro")
                    .join(", ")
                : "Aún sin respuestas"}
            </p>
          </div>
        );
      })}
    </Card>
  );
}
