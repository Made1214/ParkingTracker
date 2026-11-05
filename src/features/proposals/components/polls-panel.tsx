import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ActionForm } from "@/shared/ui/action-form";
import { dateLabel } from "@/shared/lib/utils";
import { createPoll, vote, closePoll } from "../api/actions";
import { getPolls } from "../api/queries";
import { PollRealtime } from "./poll-realtime";

export async function PollsPanel({
  groupId,
  eventId,
  open,
}: {
  groupId: string;
  eventId: string;
  open: boolean;
}) {
  const { polls, userId, isAdmin, now } = await getPolls(groupId, eventId);
  return (
    <Card>
      <PollRealtime groupId={groupId} />
      <h2>Votaciones</h2>
      {open && (
        <ActionForm action={createPoll} label="Crear votación">
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="event_id" value={eventId} />
          <label htmlFor="poll-question">Pregunta</label>
          <Input id="poll-question" name="question" maxLength={200} required />
          <label htmlFor="poll-options">
            Opciones (una por línea, de 2 a 10)
          </label>
          <textarea
            className="input"
            id="poll-options"
            name="options"
            required
            rows={4}
          />
          <label htmlFor="poll-closes">
            Fecha y hora de cierre (hora de Panamá)
          </label>
          <Input
            id="poll-closes"
            name="closes_at"
            type="datetime-local"
            required
          />
          <label>
            <input type="checkbox" name="allow_multiple" /> Permitir varias
            opciones
          </label>
        </ActionForm>
      )}
      {polls.length === 0 && (
        <p className="muted">Todavía no hay votaciones.</p>
      )}
      {polls.map((poll) => {
        const active =
          open &&
          poll.status === "open" &&
          (!poll.closes_at || Date.parse(poll.closes_at) > now);
        return (
          <section key={poll.id}>
            <hr />
            <h3>{poll.question}</h3>
            <p className="small muted">
              {active ? "Abierta" : "Cerrada"}
              {poll.closes_at &&
                ` · Cierre: ${dateLabel(poll.closes_at)} (Panamá)`}
            </p>
            <ActionForm
              key={poll.poll_votes
                .filter((v) => v.user_id === userId)
                .map((v) => v.option_id)
                .sort()
                .join(",")}
              action={vote}
              label="Guardar voto"
              disabled={!active}
            >
              <input type="hidden" name="group_id" value={groupId} />
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="poll_id" value={poll.id} />
              {poll.poll_options
                .sort((a, b) => a.position - b.position)
                .map((option) => (
                  <label key={option.id}>
                    <input
                      type={poll.allow_multiple ? "checkbox" : "radio"}
                      name="option_id"
                      value={option.id}
                      defaultChecked={poll.poll_votes.some(
                        (v) =>
                          v.user_id === userId && v.option_id === option.id,
                      )}
                      disabled={!active}
                    />{" "}
                    {option.label} —{" "}
                    {poll.results.find((v) => v.option_id === option.id)
                      ?.votes ?? 0}{" "}
                    votos
                    {!active &&
                      poll.results.some(
                        (v) =>
                          v.option_id === option.id &&
                          v.is_winner &&
                          v.votes > 0,
                      ) && <strong> · Ganadora</strong>}
                  </label>
                ))}
            </ActionForm>
            {active && (isAdmin || poll.created_by === userId) && (
              <ActionForm action={closePoll} label="Cerrar votación">
                <input type="hidden" name="group_id" value={groupId} />
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="poll_id" value={poll.id} />
              </ActionForm>
            )}
          </section>
        );
      })}
    </Card>
  );
}
