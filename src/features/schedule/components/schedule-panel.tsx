import { CalendarPlus, EllipsisVertical, Plus } from "lucide-react";
import { Disclosure } from "@/shared/ui/disclosure";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ActionForm } from "@/shared/ui/action-form";
import { panamaInput, panamaTime } from "@/shared/lib/utils";
import {
  createScheduleItem,
  deleteScheduleItem,
  updateScheduleItem,
} from "../api/actions";
import { getSchedule } from "../api/queries";
import styles from "./schedule.module.css";

function ItemFields({
  idPrefix,
  min,
  max,
  title = "",
  description = "",
  startsAt = "",
  endsAt = "",
}: {
  idPrefix: string;
  min: string;
  max: string;
  title?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
}) {
  return (
    <>
      <label htmlFor={`${idPrefix}-title`}>Actividad</label>
      <Input
        id={`${idPrefix}-title`}
        name="title"
        required
        maxLength={120}
        defaultValue={title}
        placeholder="Ej. Salida desde El Dorado"
      />
      <div className={styles.times}>
        <label>
          Empieza
          <Input
            type="datetime-local"
            name="starts_at"
            required
            min={min}
            max={max}
            defaultValue={startsAt}
          />
        </label>
        <label>
          Termina (opcional)
          <Input
            type="datetime-local"
            name="ends_at"
            min={min}
            max={max}
            defaultValue={endsAt}
          />
        </label>
      </div>
      <label htmlFor={`${idPrefix}-description`}>Detalles (opcional)</label>
      <textarea
        className="input"
        id={`${idPrefix}-description`}
        name="description"
        maxLength={500}
        rows={2}
        defaultValue={description}
      />
    </>
  );
}

export async function SchedulePanel({
  groupId,
  eventId,
}: {
  groupId: string;
  eventId: string;
}) {
  const { items, event, canEdit, pendingProposals } = await getSchedule(
    groupId,
    eventId,
  );
  const min = panamaInput(event.starts_at);
  const max = panamaInput(event.ends_at);
  const hidden = (
    <>
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="event_id" value={eventId} />
    </>
  );

  return (
    <Card className={styles.panel} aria-labelledby="schedule-title">
      <div className={styles.heading}>
        <h2 id="schedule-title">Cronograma</h2>
        <span className="small muted">
          {items.length} {items.length === 1 ? "actividad" : "actividades"} ·
          hora de Panamá
        </span>
      </div>

      {items.length ? (
        <ol className={styles.timeline}>
          {items.map((item, index) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.time}>
                {panamaTime(item.starts_at)}
                {item.ends_at && (
                  <span className={styles.until}>
                    {panamaTime(item.ends_at)}
                  </span>
                )}
              </span>
              <span className={styles.rail} aria-hidden="true">
                <span
                  className={item.proposal_id ? styles.dotProposal : styles.dot}
                />
                {index < items.length - 1 && <span className={styles.line} />}
              </span>
              <div className={styles.body}>
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
                {item.proposal_id && (
                  <span className="badge">Propuesta del grupo</span>
                )}
                {canEdit && (
                  <details className={styles.edit}>
                    <summary aria-label={`Editar ${item.title}`} title="Editar">
                      <EllipsisVertical size={18} aria-hidden="true" />
                    </summary>
                    <ActionForm
                      action={updateScheduleItem}
                      label="Guardar cambios"
                    >
                      {hidden}
                      <input type="hidden" name="id" value={item.id} />
                      <ItemFields
                        idPrefix={`edit-${item.id}`}
                        min={min}
                        max={max}
                        title={item.title}
                        description={item.description ?? ""}
                        startsAt={panamaInput(item.starts_at)}
                        endsAt={item.ends_at ? panamaInput(item.ends_at) : ""}
                      />
                    </ActionForm>
                    <ActionForm
                      action={deleteScheduleItem}
                      label="Eliminar actividad"
                      tone="danger"
                    >
                      {hidden}
                      <input type="hidden" name="id" value={item.id} />
                    </ActionForm>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="small muted">
          {canEdit
            ? "Aún no hay actividades. Arma el plan del día."
            : "Quien organiza todavía no ha armado el cronograma."}
        </p>
      )}

      {canEdit && (
        <Disclosure
          className={styles.composer}
          icon={<Plus size={18} />}
          title="Añadir actividad"
          hint="Dentro del horario de la salida"
        >
          <ActionForm action={createScheduleItem} label="Añadir al cronograma">
            {hidden}
            <ItemFields idPrefix="new-item" min={min} max={max} />
          </ActionForm>
        </Disclosure>
      )}

      {canEdit && pendingProposals.length > 0 && (
        <section className={styles.proposals} aria-labelledby="schedule-ideas">
          <h3 id="schedule-ideas">Propuestas aprobadas por agendar</h3>
          <ul>
            {pendingProposals.map((proposal) => (
              <li key={proposal.id}>
                <Disclosure
                  compact
                  icon={<CalendarPlus size={16} />}
                  title={proposal.title}
                  hint="Elige hora para agendarla"
                >
                  <ActionForm
                    action={createScheduleItem}
                    label="Agendar propuesta"
                  >
                    {hidden}
                    <input
                      type="hidden"
                      name="proposal_id"
                      value={proposal.id}
                    />
                    <ItemFields
                      idPrefix={`proposal-${proposal.id}`}
                      min={min}
                      max={max}
                      title={proposal.title}
                      description={proposal.description ?? ""}
                    />
                  </ActionForm>
                </Disclosure>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}
