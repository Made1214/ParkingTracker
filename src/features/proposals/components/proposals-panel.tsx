import { Gavel, Lightbulb } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Disclosure } from "@/shared/ui/disclosure";
import { Input } from "@/shared/ui/input";
import { ActionForm } from "@/shared/ui/action-form";
import { createProposal, reviewProposal } from "../api/actions";
import { getProposals } from "../api/queries";
import styles from "./decisions.module.css";

export async function ProposalsPanel({
  groupId,
  eventId,
  open,
}: {
  groupId: string;
  eventId: string;
  open: boolean;
}) {
  const { proposals, canReview } = await getProposals(groupId, eventId);
  return (
    <Card className={styles.panel}>
      <div className={styles.heading}>
        <div>
          <h2>Propuestas</h2>
          <p>Ideas del grupo; quien organiza decide cuáles entran al plan.</p>
        </div>
        <span className={styles.count}>
          {proposals.length} {proposals.length === 1 ? "idea" : "ideas"}
        </span>
      </div>
      {open && (
        <Disclosure
          icon={<Lightbulb size={18} />}
          title="Compartir una idea"
          hint="Una actividad, un lugar o algo que llevar"
        >
          <ActionForm
            action={createProposal}
            label="Publicar propuesta"
            disabled={!open}
          >
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="event_id" value={eventId} />
            <label htmlFor="proposal-title">Título</label>
            <Input id="proposal-title" name="title" required maxLength={120} />
            <label htmlFor="proposal-description">Descripción</label>
            <textarea
              className="input"
              id="proposal-description"
              name="description"
              maxLength={2000}
              rows={3}
            />
          </ActionForm>
        </Disclosure>
      )}
      {proposals.length ? (
        <ul className={styles.proposals}>
          {proposals.map((proposal) => (
            <li key={proposal.id} className={styles.proposal}>
              <h3>{proposal.title}</h3>
              <span className="badge">
                {
                  {
                    open: "Por revisar",
                    accepted: "Aprobada",
                    rejected: "Rechazada",
                  }[proposal.status]
                }
              </span>
              {proposal.description && (
                <p className="description">{proposal.description}</p>
              )}
              <p className="small muted">
                Propuesta por {proposal.profiles?.display_name ?? "Miembro"}
              </p>
              {open && canReview && (
                <Disclosure
                  compact
                  icon={<Gavel size={16} />}
                  title="Revisar propuesta"
                >
                  <ActionForm action={reviewProposal} label="Guardar decisión">
                    <input type="hidden" name="group_id" value={groupId} />
                    <input type="hidden" name="event_id" value={eventId} />
                    <input
                      type="hidden"
                      name="proposal_id"
                      value={proposal.id}
                    />
                    <label>
                      Decisión
                      <select
                        className="input"
                        name="status"
                        defaultValue={
                          proposal.status === "rejected"
                            ? "rejected"
                            : "accepted"
                        }
                      >
                        <option value="accepted">Aprobar</option>
                        <option value="rejected">Rechazar</option>
                      </select>
                    </label>
                  </ActionForm>
                </Disclosure>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">
          Todavía no hay propuestas. ¡Comparte la primera!
        </p>
      )}
    </Card>
  );
}
