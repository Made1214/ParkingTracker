import { z } from "zod";
import type { ReceiptResult } from "./engine";
import type { ReceiptDocument } from "./document";
import { computeSettlement } from "./settlement";
import { receiptFingerprint } from "./review";

/**
 * Resultado congelado al finalizar una factura (`receipts.result`). Es lo que
 * ve cada participante en su copia personalizada; no se recalcula aunque
 * cambie el código del motor.
 */

const line = z.object({
  itemId: z.string(),
  name: z.string(),
  cents: z.number().int(),
  numerator: z.number().int(),
  denominator: z.number().int(),
  shared: z.boolean(),
});

const person = z.object({
  participantId: z.string(),
  name: z.string(),
  kind: z.enum(["member", "guest"]),
  lines: z.array(line),
  itemsCents: z.number().int(),
  discountsCents: z.number().int(),
  taxCents: z.number().int(),
  includedTaxCents: z.number().int(),
  tipCents: z.number().int(),
  chargesCents: z.number().int(),
  adjustmentsCents: z.number().int(),
  totalCents: z.number().int(),
  paidCents: z.number().int(),
  /** pagado − consumido: > 0 le deben, < 0 debe. */
  netCents: z.number().int(),
});

const snapshot = z.object({
  schemaVersion: z.literal(1),
  computedAt: z.string(),
  fingerprint: z.string().nullable(),
  totalCents: z.number().int(),
  people: z.array(person),
});

export type ReceiptSnapshot = z.infer<typeof snapshot>;
export type PersonSnapshot = ReceiptSnapshot["people"][number];

export function readResult(value: unknown): ReceiptSnapshot | null {
  const parsed = snapshot.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function buildSnapshot(
  doc: ReceiptDocument,
  result: ReceiptResult,
  now = new Date(),
): ReceiptSnapshot | { error: string } {
  if (!result.canFinalize || doc.printedTotalCents === null)
    return { error: "La factura aún tiene datos por resolver." };
  const consumed = new Map(
    result.people.map((p) => [p.participantId, p.totalCents]),
  );
  const settlement = computeSettlement(
    doc.participants.map((p) => p.id),
    consumed,
    doc.payments.map((p) => ({
      participantId: p.participantId,
      cents: p.cents,
    })),
  );
  if (!settlement.ok) return { error: settlement.error };
  const balances = new Map(
    settlement.balances.map((b) => [b.participantId, b]),
  );
  return {
    schemaVersion: 1,
    computedAt: now.toISOString(),
    fingerprint:
      doc.merchant && doc.date
        ? receiptFingerprint({
            merchant: doc.merchant,
            date: doc.date,
            totalCents: doc.printedTotalCents,
            invoiceNumber: doc.invoiceNumber,
          })
        : null,
    totalCents: doc.printedTotalCents,
    people: doc.participants.map((p) => {
      const share = result.people.find((r) => r.participantId === p.id)!;
      const balance = balances.get(p.id)!;
      return {
        participantId: p.id,
        name: p.name,
        kind: p.kind,
        lines: share.lines,
        itemsCents: share.itemsCents,
        discountsCents: share.discountsCents,
        taxCents: share.taxCents,
        includedTaxCents: share.includedTaxCents,
        tipCents: share.tipCents,
        chargesCents: share.chargesCents,
        adjustmentsCents: share.adjustmentsCents,
        totalCents: share.totalCents,
        paidCents: balance.paidCents,
        netCents: balance.netCents,
      };
    }),
  };
}
