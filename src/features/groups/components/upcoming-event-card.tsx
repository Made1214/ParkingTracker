"use client";

import { useActionState, useOptimistic, useRef } from "react";
import Link from "next/link";
import type { ActionState } from "@/shared/lib/forms";
import { Button } from "@/shared/ui/button";
import { FeedbackToast } from "@/shared/ui/feedback-toast";
import styles from "./upcoming-events.module.css";

const responses = [
  { value: "going", label: "Voy" },
  { value: "maybe", label: "Quizás" },
  { value: "declined", label: "No voy" },
] as const;
type Response = (typeof responses)[number]["value"];
type Feedback = { error?: string; success?: string; id: number };

export function UpcomingEventCard({
  eventId,
  groupId,
  title,
  groupName,
  date,
  location,
  current,
  respond,
}: {
  eventId: string;
  groupId: string;
  title: string;
  groupName: string;
  date: string;
  location: string | null;
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
    <article className={styles.event}>
      <div>
        <p className={styles.group}>{groupName}</p>
        <h3>
          <Link href={`/groups/${groupId}/events/${eventId}`}>{title}</Link>
        </h3>
        <p className="small muted">
          {date}
          {location ? ` · ${location}` : ""}
        </p>
        <p className="small muted" aria-live="polite">
          {selected
            ? `Tu respuesta: ${responses.find((response) => response.value === selected)?.label}`
            : "Aún no has respondido"}
        </p>
      </div>
      <form
        className={styles.responses}
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
          <Button
            key={response.value}
            type="submit"
            name="status"
            value={response.value}
            aria-pressed={selected === response.value}
            disabled={pending || selected === response.value}
            className={styles.response}
          >
            {response.label}
          </Button>
        ))}
      </form>
      {(feedback.success || feedback.error) && (
        <FeedbackToast
          key={feedback.id}
          message={feedback.error ?? feedback.success ?? ""}
          isError={Boolean(feedback.error)}
        />
      )}
    </article>
  );
}
