"use client";

import { useActionState, useOptimistic, useRef } from "react";
import type { getAttendance } from "../api/queries";
import { respond } from "../api/actions";
import { Card } from "@/shared/ui/card";
import { FeedbackToast } from "@/shared/ui/feedback-toast";
import styles from "./attendance.module.css";
const options = [
  { value: "going", label: "Voy", plural: "Van" },
  { value: "maybe", label: "Quizás", plural: "Quizás" },
  { value: "declined", label: "No voy", plural: "No van" },
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
    <Card className={styles.card}>
      <div className={styles.header}>
        <h2>Asistencia</h2>
        <span className="small muted">
          {total} {total === 1 ? "respuesta" : "respuestas"}
        </span>
      </div>
      <form
        className={styles.segmented}
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
          <button
            key={option.value}
            type="submit"
            name="status"
            value={option.value}
            data-status={option.value}
            disabled={!open || pending}
            aria-pressed={own?.status === option.value}
          >
            {option.label}
          </button>
        ))}
      </form>
      <p className="small muted" role="status">
        {own
          ? `Tu respuesta: ${options.find((option) => option.value === own.status)?.label}. `
          : ""}
        {open
          ? "Puedes cambiarla hasta que empiece la salida."
          : "Las confirmaciones están cerradas."}
      </p>
      {(state.success || state.error) && (
        <FeedbackToast
          key={state.id}
          message={state.error ?? state.success ?? ""}
          isError={Boolean(state.error)}
        />
      )}
      {total > 0 && (
        <div className={styles.meter} aria-hidden="true">
          <span
            data-status="going"
            style={{ width: `${(goingCount / total) * 100}%` }}
          />
          <span
            data-status="maybe"
            style={{ width: `${(maybeCount / total) * 100}%` }}
          />
          <span
            data-status="declined"
            style={{ width: `${(declinedCount / total) * 100}%` }}
          />
        </div>
      )}
      <dl className={styles.people}>
        {options.map((option) => {
          const people = attendance
            .filter((row) => row.status === option.value)
            .map((row) =>
              row.user_id === userId
                ? "Tú"
                : (row.profiles?.display_name ?? "Miembro"),
            );
          return (
            <div key={option.value} data-status={option.value}>
              <dt>
                {option.plural} <span>{people.length}</span>
              </dt>
              <dd>{people.length ? people.join(", ") : "—"}</dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}
