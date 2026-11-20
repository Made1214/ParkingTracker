import Link from "next/link";
import { ArrowRight, ScanLine, UsersRound } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { ActionForm } from "@/shared/ui/action-form";
import { Disclosure } from "@/shared/ui/disclosure";
import { Input } from "@/shared/ui/input";
import { initials } from "@/shared/lib/utils";
import {
  manageEventGuest,
  settleGuestDebt,
  startReceipt,
} from "../api/actions";
import { getEventReceipts } from "../api/queries";
import { money } from "./helpers";
import styles from "./receipts.module.css";

/** Facturas y deudas de invitados, dentro de la pestaña Gastos. */
export async function ReceiptsSection({
  groupId,
  eventId,
  open,
}: {
  groupId: string;
  eventId: string;
  open: boolean;
}) {
  const data = await getEventReceipts(groupId, eventId);
  const hidden = (
    <>
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="event_id" value={eventId} />
    </>
  );
  return (
    <>
      <Card>
        <div className={styles.sectionHead}>
          <h2>Facturas</h2>
          {open && (
            <ActionForm
              action={startReceipt}
              label="Escanear factura"
              className={styles.startForm}
            >
              {hidden}
            </ActionForm>
          )}
        </div>
        <p className="small muted">
          <ScanLine size={14} aria-hidden="true" /> Toma una foto de la cuenta,
          marca qué consumió cada quien (también invitados) y se crean los
          gastos al centavo.
        </p>
        {data.receipts.length > 0 && (
          <ul className={styles.receiptList}>
            {data.receipts.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/groups/${groupId}/events/${eventId}/receipts/${r.id}`}
                >
                  <span>
                    <strong>{r.merchant ?? "Factura sin nombre"}</strong>
                    <span className="small muted">
                      {r.status === "finalized" ? "Repartida" : "Borrador"} ·{" "}
                      {r.people} {r.people === 1 ? "persona" : "personas"}
                    </span>
                  </span>
                  <span>
                    {money(r.totalCents)}{" "}
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(open || data.guests.length > 0) && (
        <Disclosure
          icon={<UsersRound size={18} />}
          title="Invitados de la salida"
        >
          {open && (
            <ActionForm action={manageEventGuest} label="Añadir invitado">
              {hidden}
              <input type="hidden" name="operation" value="add" />
              <label>
                Nombre <Input name="name" required maxLength={60} />
              </label>
            </ActionForm>
          )}
          {data.guests.length > 0 && (
            <ul>
              {data.guests.map((guest) => (
                <li key={guest.id}>
                  {open && guest.canManage ? (
                    <details>
                      <summary>{guest.name}</summary>
                      <ActionForm
                        action={manageEventGuest}
                        label="Guardar nombre"
                      >
                        {hidden}
                        <input type="hidden" name="guest_id" value={guest.id} />
                        <input type="hidden" name="operation" value="rename" />
                        <label>
                          Nombre{" "}
                          <Input
                            name="name"
                            defaultValue={guest.name}
                            required
                            maxLength={60}
                          />
                        </label>
                      </ActionForm>
                      <ActionForm
                        action={manageEventGuest}
                        label="Eliminar invitado"
                        tone="danger"
                      >
                        {hidden}
                        <input type="hidden" name="guest_id" value={guest.id} />
                        <input type="hidden" name="operation" value="delete" />
                      </ActionForm>
                    </details>
                  ) : (
                    guest.name
                  )}
                </li>
              ))}
            </ul>
          )}
        </Disclosure>
      )}

      {data.guestDebts.length > 0 && (
        <Card>
          <h2>Invitados por cobrar</h2>
          <p className="small muted">
            Personas sin cuenta. Le deben directamente a quien pagó.
          </p>
          <ul className={styles.guestDebts}>
            {data.guestDebts.map((d) => (
              <li key={`${d.guestId}-${d.creditorId}`}>
                <span className={styles.payName}>
                  <span className={styles.avatar} aria-hidden="true">
                    {initials(d.guestName)}
                  </span>
                  {d.guestName} → {d.creditorName}
                </span>
                <strong>{money(d.cents)}</strong>
                {d.canSettle && (
                  <ActionForm
                    action={settleGuestDebt}
                    label="Ya me pagó"
                    tone="outline"
                    className={styles.startForm}
                  >
                    {hidden}
                    <input type="hidden" name="guest_id" value={d.guestId} />
                    <input type="hidden" name="creditor" value={d.creditorId} />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
