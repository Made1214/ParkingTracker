"use client";

import { useActionState, useOptimistic, useRef } from "react";
import type { getAttendance } from "../api/queries";
import { respond } from "../api/actions";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { FeedbackToast } from "@/shared/ui/feedback-toast";
const options = [
  { value: "going", label: "Voy", icon: "✓" },
  { value: "maybe", label: "Quizás", icon: "?" },
  { value: "declined", label: "No voy", icon: "−" },
] as const;
export function AttendanceView({
  groupId,
  eventId,
  userId,
  open,
  attendance: initialAttendance,
}: {
  groupId: string;
  eventId: string;
  userId: string;
  open: boolean;
  attendance: Awaited<ReturnType<typeof getAttendance>>;
}) {
  const inFlight = useRef(false);
  const sequence = useRef(0);
  const [attendance, setOptimisticAttendance] = useOptimistic(
    initialAttendance,
    (current, status: (typeof options)[number]["value"]) => {
      const own = current.find((row) => row.user_id === userId);
      return own
        ? current.map((row) =>
            row.user_id === userId ? { ...row, status } : row,
          )
        : [
            ...current,
            { user_id: userId, status, profiles: { display_name: "Tú" } },
          ];
    },
  );
  const [state, formAction, pending] = useActionState(
    async (
      _: { error?: string; success?: string; id: number },
      form: FormData,
    ) => {
      const status = form.get("status");
      if (!options.some((option) => option.value === status)) {
        inFlight.current = false;
        return { error: "La respuesta no es válida.", id: ++sequence.current };
      }
      setOptimisticAttendance(status as (typeof options)[number]["value"]);
      try {
        const result = await respond({}, form);
        return { ...result, id: ++sequence.current };
      } catch {
        return {
          error: "No se pudo guardar. Inténtalo de nuevo.",
          id: ++sequence.current,
        };
      } finally {
        inFlight.current = false;
      }
    },
    { id: 0 },
  );
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
      <form
        className="rsvp-options"
        action={formAction}
        aria-label="Confirmar asistencia"
        aria-busy={pending}
        onSubmit={(event) => {
          if (inFlight.current) {
            event.preventDefault();
            return;
          }
          inFlight.current = true;
        }}
      >
        <input type="hidden" name="group_id" value={groupId} />
        <input type="hidden" name="event_id" value={eventId} />
        {options.map((option) => (
          <div
            key={option.value}
            className={`rsvp-form rsvp-${option.value} ${own?.status === option.value ? "selected" : ""}`}
          >
            <Button
              type="submit"
              name="status"
              value={option.value}
              disabled={!open || pending}
              aria-pressed={own?.status === option.value}
            >
              {option.icon} {option.label}
            </Button>
          </div>
        ))}
      </form>
      {(state.success || state.error) && (
        <FeedbackToast
          key={state.id}
          message={state.error ?? state.success ?? ""}
          isError={Boolean(state.error)}
        />
      )}
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
