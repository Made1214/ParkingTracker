import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/shared/ui/action-form";
import { deleteReceipt } from "../api/actions";
import { getReceiptPage } from "../api/queries";
import { ReceiptFlow } from "./receipt-flow";
import { ReceiptSummary } from "./receipt-summary";
import styles from "./receipts.module.css";

export async function ReceiptScreen({
  groupId,
  eventId,
  receiptId,
}: {
  groupId: string;
  eventId: string;
  receiptId: string;
}) {
  const data = await getReceiptPage(groupId, eventId, receiptId);
  const finalized = data.status === "finalized" && data.result;
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <Link
          className="back-link"
          href={`/groups/${groupId}/events/${eventId}?section=gastos`}
        >
          <ArrowLeft size={16} aria-hidden="true" /> {data.eventTitle}
        </Link>
        <span className="eyebrow">
          {finalized ? "FACTURA REPARTIDA" : "NUEVA FACTURA · BORRADOR"}
        </span>
        <h1>{data.document.merchant ?? "Factura"}</h1>
      </header>
      {finalized ? (
        <ReceiptSummary data={data} result={data.result!} />
      ) : (
        <>
          {!data.eventOpen && (
            <p className="message error">La salida está cancelada.</p>
          )}
          {/* key: al cambiar de versión desde el servidor se reinicia el estado. */}
          <ReceiptFlow key={data.version} data={data} />
          {data.canEdit && (
            <ActionForm
              action={deleteReceipt}
              label="Descartar borrador"
              tone="danger"
              className={styles.discard}
            >
              <input type="hidden" name="group_id" value={groupId} />
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="receipt_id" value={receiptId} />
            </ActionForm>
          )}
        </>
      )}
    </div>
  );
}
