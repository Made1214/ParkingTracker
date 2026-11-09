"use client";

import { useActionState, useOptimistic, useRef } from "react";
import type { ActionState } from "@/shared/lib/forms";
import { FeedbackToast } from "@/shared/ui/feedback-toast";
import styles from "./home.module.css";

const responses = [
  { value: "going", label: "Voy" },
  { value: "maybe", label: "Quizás" },
  { value: "declined", label: "No voy" },
] as const;
type Response = (typeof responses)[number]["value"];
type Feedback = { error?: string; success?: string; id: number };

/** "¿Vas a ir?" con control segmentado y respuesta optimista. */
export function RsvpBar({
  eventId,
  groupId,
  title,
  current,
  respond,
}: {
  eventId: string;
  groupId: string;
  title: string;
  current?: Response;
  respond: (state: ActionState, data: FormData) => Promise<ActionState>;
}) {
  const [selected, setOptimistic] = useOptimistic(current);
  const inFlight = useRef(false);
  const sequence = useRef(0);
  const [feedback, action, pending] = useActionState(
    async (_: Feedback, data: FormData): Promise<Feedback> => {
      const value = data.get("status");
      if (!responses.some((response) => response.value === value)) {
        inFlight.current = false;
        return { error: "La respuesta no es válida.", id: ++sequence.current };
      }
      setOptimistic(value as Response);
      try {
        const result = await respond({}, data);
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

  return (
    <div className={styles.rsvpBar}>
      <strong>¿Vas a ir?</strong>
      <form
        className={styles.segmented}
        action={action}
        aria-label={`Confirmar asistencia a ${title}`}
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
        {responses.map((response) => (
          <button
            key={response.value}
            type="submit"
            name="status"
            value={response.value}
            data-status={response.value}
            aria-pressed={selected === response.value}
            disabled={pending}
          >
            {response.label}
          </button>
        ))}
      </form>
      {(feedback.success || feedback.error) && (
        <FeedbackToast
          key={feedback.id}
          message={feedback.error ?? feedback.success ?? ""}
          isError={Boolean(feedback.error)}
        />
      )}
    </div>
  );
}
