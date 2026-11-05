import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ActionForm } from "@/shared/ui/action-form";
import { createProposal } from "../api/actions";
import { getProposals } from "../api/queries";

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
    <Card>
      <h2>Propuestas de actividades</h2>
      <p className="muted">Comparte una idea para esta salida.</p>
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
      <hr />
      {proposals.length ? (
        <ul>
          {proposals.map((proposal) => (
            <li key={proposal.id}>
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
