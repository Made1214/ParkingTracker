import { BarChart3, CheckCircle2, Clock3, Vote } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { ActionForm } from "@/shared/ui/action-form";
import { dateLabel } from "@/shared/lib/utils";
import { vote, closePoll } from "../api/actions";
import { getPolls } from "../api/queries";
import { PollRealtime } from "./poll-realtime";
import { PollComposer } from "./poll-composer";
import styles from "./decisions.module.css";

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
    <Card className={styles.panel}>
      <PollRealtime
        groupId={groupId}
        eventId={eventId}
        pollIds={polls
          .map((poll) => poll.id)
          .sort()
          .join(",")}
        refreshAt={polls.reduce<number | undefined>((next, poll) => {
          const deadline = poll.closes_at ? Date.parse(poll.closes_at) : 0;
          return poll.status === "open" &&
            deadline > now &&
            (!next || deadline < next)
            ? deadline
            : next;
        }, undefined)}
      />
      <div className={styles.heading}>
        <div className={styles.headingMain}>
          <span className={styles.headingIcon}>
            <Vote size={20} aria-hidden="true" />
          </span>
          <div>
            <span className={styles.eyebrow}>DECIDAMOS JUNTOS</span>
            <h2>Votaciones</h2>
            <p>Una pregunta, varias ideas y una decisión en equipo.</p>
          </div>
        </div>
        <span className={styles.count}>
          {polls.length} {polls.length === 1 ? "votación" : "votaciones"}
        </span>
      </div>
      {open && <PollComposer groupId={groupId} eventId={eventId} />}
      {polls.length === 0 && (
        <div className={styles.emptyPoll}>
          <span className={styles.emptyIcon}>
            <BarChart3 size={25} aria-hidden="true" />
          </span>
          <div>
            <h3>Las buenas ideas se deciden juntos</h3>
            <p>
              {open
                ? "Crea la primera votación para que todos puedan elegir."
                : "No se crearon votaciones para esta salida."}
            </p>
          </div>
        </div>
      )}
      {polls.map((poll) => {
        const active =
          open &&
          poll.status === "open" &&
          (!poll.closes_at || Date.parse(poll.closes_at) > now);
        const total = poll.results.reduce(
          (sum, result) => sum + Number(result.votes),
          0,
        );
        const winners = poll.results.filter(
          (result) => result.is_winner && Number(result.votes) > 0,
        ).length;
        return (
          <section key={poll.id} className={styles.poll}>
            <div className={styles.pollHeader}>
              <span className={styles.status} data-active={active}>
                <span aria-hidden="true" />
                {active ? "Abierta" : "Cerrada"}
              </span>
              <span className={styles.pollType}>
                {poll.allow_multiple ? "Selección múltiple" : "Una respuesta"}
              </span>
            </div>
            <h3>{poll.question}</h3>
            <p className={styles.meta}>
              {total} {total === 1 ? "voto emitido" : "votos emitidos"}.
              Porcentajes sobre el total de opciones votadas.
            </p>
            {poll.closes_at && (
              <p className={styles.meta}>
                <Clock3 size={14} aria-hidden="true" />{" "}
                {active ? "Cierra" : "Cierre"}: {dateLabel(poll.closes_at)} ·
                Panamá
              </p>
            )}
            <ActionForm
              key={poll.poll_votes
                .filter((v) => v.user_id === userId)
                .map((v) => v.option_id)
                .sort()
                .join(",")}
              action={vote}
              label="Guardar voto"
              disabled={!active}
              hideSubmit={!active}
            >
              <input type="hidden" name="group_id" value={groupId} />
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="poll_id" value={poll.id} />
              <fieldset className={styles.options} disabled={!active}>
                <legend className="sr-only">
                  Opciones para {poll.question}
                </legend>
                {[...poll.poll_options]
                  .sort((a, b) => a.position - b.position)
                  .map((option) => {
                    const result = poll.results.find(
                      (v) => v.option_id === option.id,
                    );
                    const count = Number(result?.votes ?? 0);
                    const width = total ? Math.round((count / total) * 100) : 0;
                    return (
                      <label key={option.id} className={styles.option}>
                        <span className={styles.optionTop}>
                          <input
                            type={poll.allow_multiple ? "checkbox" : "radio"}
                            name="option_id"
                            value={option.id}
                            defaultChecked={poll.poll_votes.some(
                              (v) =>
                                v.user_id === userId &&
                                v.option_id === option.id,
                            )}
                            disabled={!active}
                          />
                          <span className={styles.optionText}>
                            {option.label}
                          </span>
                          <span className={styles.votes}>
                            {count} {count === 1 ? "voto" : "votos"}
                            {" · "}
                            {width}%
                          </span>
                        </span>
                        <span className={styles.progress} aria-hidden="true">
                          <span style={{ width: width + "%" }} />
                        </span>
                        {!active && result?.is_winner && count > 0 && (
                          <span className={styles.winner}>
                            <CheckCircle2 size={14} aria-hidden="true" />{" "}
                            {winners > 1 ? "Empate" : "Ganadora"}
                          </span>
                        )}
                      </label>
                    );
                  })}
              </fieldset>
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
