import { Lightbulb } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ActionForm } from "@/shared/ui/action-form";
import { createProposal } from "../api/actions";
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
  const proposals = await getProposals(groupId, eventId);
  return (
    <Card className={styles.panel}>
      <div className={styles.heading}>
        <div className={styles.headingMain}>
          <span className={styles.headingIcon}>
            <Lightbulb size={20} aria-hidden="true" />
          </span>
          <div>
            <span className={styles.eyebrow}>INSPIRACI?N PARA EL PLAN</span>
            <h2>Propuestas</h2>
            <p>Comparte una idea para esta salida.</p>
          </div>
        </div>
        <span className={styles.count}>
          {proposals.length} {proposals.length === 1 ? "idea" : "ideas"}
        </span>
      </div>
      {open && (
        <details className={styles.composer}>
          <summary>Compartir una idea</summary>
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
        </details>
      )}
      {proposals.length ? (
        <ul className={styles.proposals}>
          {proposals.map((proposal) => (
            <li key={proposal.id} className={styles.proposal}>
              <h3>{proposal.title}</h3>
              {proposal.description && (
                <p className="description">{proposal.description}</p>
              )}
              <p className="small muted">
                Propuesta por {proposal.profiles?.display_name ?? "Miembro"}
              </p>
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
