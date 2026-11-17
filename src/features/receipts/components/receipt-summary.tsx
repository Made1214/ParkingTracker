"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Printer } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { initials } from "@/shared/lib/utils";
import { reopenReceipt } from "../api/actions";
import type { ReceiptPageData } from "../api/queries";
import type { PersonSnapshot, ReceiptSnapshot } from "../lib/snapshot";
import { ReceiptImage, type Highlight } from "./receipt-image";
import { money, percentLabel, personTone } from "./helpers";
import styles from "./receipts.module.css";

/** Las coordenadas se usan solo si el OCR fue fiable para esa línea. */
const RELIABLE = 0.5;

export function ReceiptSummary({
  data,
  result,
}: {
  data: ReceiptPageData;
  result: ReceiptSnapshot;
}) {
  const router = useRouter();
  const doc = data.document;
  const mine = result.people.find((p) => p.participantId === data.userId);
  const [selected, setSelected] = useState(
    mine?.participantId ?? result.people[0]?.participantId ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const person = result.people.find((p) => p.participantId === selected);
  const toneOf = new Map(doc.participants.map((p, i) => [p.id, personTone(i)]));
  const imageSrc = data.hasImage
    ? `/api/groups/${data.groupId}/events/${data.eventId}/receipts/${data.receiptId}/image?v=${data.version}`
    : null;
  const items = new Map(doc.items.map((i) => [i.id, i]));
  const ocrReliable = doc.ocr.status === "done" && Boolean(doc.ocr.imageWidth);
  const highlights: Highlight[] = person
    ? person.lines.flatMap((line) => {
        const item = items.get(line.itemId);
        if (!ocrReliable || !item?.bbox || (item.confidence ?? 1) < RELIABLE)
          return [];
        return [
          {
            key: line.itemId,
            bbox: item.bbox,
            tone: toneOf.get(person.participantId) ?? "p0",
            label: line.shared
              ? percentLabel(line.numerator, line.denominator)
              : undefined,
            strength: line.numerator / line.denominator,
          },
        ];
      })
    : [];

  async function reopen() {
    if (
      !window.confirm(
        "La factura ya está liquidada. Al corregirla se borran sus gastos y deudas hasta que la vuelvas a finalizar. ¿Continuar?",
      )
    )
      return;
    setBusy(true);
    const response = await reopenReceipt({
      groupId: data.groupId,
      eventId: data.eventId,
      receiptId: data.receiptId,
      version: data.version,
    });
    setBusy(false);
    if (!response.ok) return setError(response.error);
    router.refresh();
  }

  return (
    <div className={styles.summary}>
      <div
        className={`${styles.chips} ${styles.noPrint}`}
        role="tablist"
        aria-label="Ver la parte de"
      >
        {result.people.map((p) => (
          <button
            key={p.participantId}
            type="button"
            role="tab"
            aria-selected={p.participantId === selected}
            className={`${styles.chip} ${styles[toneOf.get(p.participantId) ?? "p0"]}`}
            onClick={() => setSelected(p.participantId)}
          >
            <span className={styles.avatar} aria-hidden="true">
              {initials(p.name)}
            </span>
            {p.participantId === data.userId ? `${p.name} (tú)` : p.name}
          </button>
        ))}
      </div>

      <div className={styles.review}>
        <div className={styles.reviewImage}>
          <ReceiptImage
            src={imageSrc}
            highlights={highlights}
            alt={`Factura con lo que consumió ${person?.name ?? ""}`}
          />
          {imageSrc && person && highlights.length < person.lines.length && (
            <p className="small muted">
              Algunos artículos no se marcan en la foto porque su posición no se
              leyó con seguridad; aparecen en la lista.
            </p>
          )}
        </div>
        {person && (
          <PersonReceipt
            person={person}
            merchant={doc.merchant}
            date={doc.date}
            tone={toneOf.get(person.participantId) ?? "p0"}
            payers={result.people.filter((p) => p.paidCents > 0)}
          />
        )}
      </div>

      {error && (
        <p role="alert" className="message error">
          {error}
        </p>
      )}
      <div className={`${styles.actions} ${styles.noPrint}`}>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> Imprimir o guardar PDF
        </Button>
        {data.canEdit && data.eventOpen && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={reopen}
          >
            <Pencil size={16} aria-hidden="true" /> Corregir factura
          </Button>
        )}
      </div>
    </div>
  );
}

function PersonReceipt({
  person,
  merchant,
  date,
  tone,
  payers,
}: {
  person: PersonSnapshot;
  merchant: string | null;
  date: string | null;
  tone: string;
  payers: PersonSnapshot[];
}) {
  const own = person.lines.filter((l) => !l.shared);
  const shared = person.lines.filter((l) => l.shared);
  const status =
    person.netCents === 0
      ? "Sin saldo pendiente en esta factura."
      : person.netCents > 0
        ? `Le deben ${money(person.netCents)}.`
        : `Debe ${money(-person.netCents)}${
            payers.length === 1 ? ` a ${payers[0].name}` : ""
          }.`;
  return (
    <section className={`card ${styles.personReceipt} ${styles[tone]}`}>
      <header>
        <span className="eyebrow">{merchant ?? "Factura"}</span>
        <h2>{person.name}</h2>
        {date && <p className="small muted">{date}</p>}
      </header>
      {own.length > 0 && (
        <>
          <h3 className={styles.subhead}>Lo que consumió</h3>
          <ul className={styles.lines}>
            {own.map((l) => (
              <li key={l.itemId}>
                <span>{l.name}</span>
                <strong>{money(l.cents)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
      {shared.length > 0 && (
        <>
          <h3 className={styles.subhead}>Compartido</h3>
          <ul className={styles.lines}>
            {shared.map((l) => (
              <li key={l.itemId}>
                <span>
                  {l.name}{" "}
                  <span className={styles.share}>
                    {percentLabel(l.numerator, l.denominator)}
                  </span>
                </span>
                <strong>{money(l.cents)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
      <dl className={styles.breakdown}>
        <dt>Subtotal</dt>
        <dd>{money(person.itemsCents)}</dd>
        {person.discountsCents !== 0 && (
          <>
            <dt>Descuentos</dt>
            <dd>{money(person.discountsCents)}</dd>
          </>
        )}
        <dt>Impuestos</dt>
        <dd>{money(person.taxCents)}</dd>
        <dt>Propina</dt>
        <dd>{money(person.tipCents)}</dd>
        {person.chargesCents + person.adjustmentsCents !== 0 && (
          <>
            <dt>Cargos y ajustes</dt>
            <dd>{money(person.chargesCents + person.adjustmentsCents)}</dd>
          </>
        )}
        <dt className={styles.totalRow}>Total</dt>
        <dd className={styles.totalRow}>{money(person.totalCents)}</dd>
        <dt>Pagó</dt>
        <dd>{money(person.paidCents)}</dd>
      </dl>
      <p
        className={styles.status}
        data-state={
          person.netCents < 0 ? "owes" : person.netCents > 0 ? "owed" : "even"
        }
      >
        {status}
      </p>
      {person.includedTaxCents > 0 && (
        <p className="small muted">
          Incluye {money(person.includedTaxCents)} de impuestos ya contenidos en
          los precios.
        </p>
      )}
    </section>
  );
}
