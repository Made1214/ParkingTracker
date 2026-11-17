import { z } from "zod";
import type {
  ItemAllocation,
  ReceiptCharge,
  ReceiptInput,
  ReceiptItem,
  ReceiptTax,
} from "./engine";
import type { LedgerParticipant } from "./ledger";

/**
 * Documento de una factura (borrador). Se guarda en `receipts.document` y se
 * valida aquí en el servidor antes de cada guardado; la base de datos solo
 * comprueba forma y tamaño. Los importes van siempre en centavos enteros.
 */

const cents = z.number().int().min(-100_000_000).max(100_000_000);
const id = z.string().min(1).max(64);
const name = z.string().trim().min(1).max(120);
/** Texto editable: puede quedar vacío mientras se escribe. */
const label = z.string().trim().max(120);
const confidence = z.number().min(0).max(1).optional();
/** Región en la imagen, normalizada a 0..1. */
const bbox = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  .optional();

export const establishmentTypes = [
  "restaurant_with_alcohol",
  "restaurant_without_alcohol",
  "bar",
  "supermarket",
  "pharmacy",
  "other",
] as const;

export const itemCategories = [
  "food",
  "non_alcoholic_beverage",
  "alcoholic_beverage",
  "tobacco",
  "groceries_basic",
  "medicine",
  "service",
  "other",
] as const;

export const paymentMethods = [
  "cash",
  "card",
  "yappy",
  "transfer",
  "other",
] as const;

const participant = z.discriminatedUnion("kind", [
  z.object({ id, name, kind: z.literal("member"), userId: z.guid() }),
  z.object({ id, name, kind: z.literal("guest"), guestId: z.guid() }),
]);

const item = z.object({
  id,
  name: label,
  quantity: z.number().int().min(1).max(999),
  unitPriceCents: cents.nullable(),
  lineTotalCents: cents.nullable(),
  discountCents: cents.min(0).optional(),
  taxId: id.nullable().optional(),
  category: z.enum(itemCategories).optional(),
  confidence,
  bbox,
});

const share = z.object({
  participantId: id,
  value: z.number().int().min(0).max(100_000_000),
});

const allocation = z.discriminatedUnion("mode", [
  z.object({
    itemId: id,
    mode: z.literal("equal"),
    participantIds: z.array(id).max(60),
  }),
  z.object({
    itemId: id,
    mode: z.enum(["units", "percent", "amount"]),
    shares: z.array(share).max(60),
  }),
]);

const tax = z.object({
  id,
  label,
  amountCents: cents.nullable(),
  rateBp: z.number().int().min(0).max(10_000).nullable().optional(),
  included: z.boolean(),
  base: z.enum(["items", "all_items"]),
  confidence,
  bbox,
});

const splitRule = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("proportional"),
    basis: z.enum(["items", "items_plus_tax"]).optional(),
    participantIds: z.array(id).max(60).optional(),
  }),
  z.object({
    method: z.literal("equal"),
    participantIds: z.array(id).max(60).optional(),
  }),
  z.object({ method: z.literal("custom"), shares: z.array(share).max(60) }),
]);

const charge = z.object({
  id,
  label,
  kind: z.enum([
    "discount",
    "tip",
    "service_charge",
    "other_charge",
    "adjustment",
  ]),
  amountCents: cents.nullable(),
  status: z.enum(["paid", "suggested"]),
  split: splitRule,
  confidence,
  bbox,
});

const payment = z.object({
  participantId: id,
  cents: cents.min(1),
  method: z.enum(paymentMethods),
  note: z.string().trim().max(200).optional(),
});

export const receiptDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    merchant: z.string().trim().max(120).nullable(),
    date: z.iso.date().nullable(),
    invoiceNumber: z.string().trim().max(60).nullable(),
    establishment: z.enum(establishmentTypes),
    printedTotalCents: cents.min(0).nullable(),
    printedTotalConfidence: confidence,
    participants: z.array(participant).max(60),
    items: z.array(item).max(300),
    allocations: z.array(allocation).max(300),
    taxes: z.array(tax).max(20),
    charges: z.array(charge).max(30),
    payments: z.array(payment).max(60),
    ocr: z.object({
      status: z.enum(["none", "done", "failed"]),
      confidence,
      imageWidth: z.number().int().min(1).max(20_000).optional(),
      imageHeight: z.number().int().min(1).max(20_000).optional(),
    }),
  })
  .superRefine((doc, ctx) => {
    const unique = (values: string[], what: string) => {
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: "custom", message: `${what} repetidos` });
    };
    unique(
      doc.participants.map((p) => p.id),
      "Participantes",
    );
    unique(
      doc.participants.map((p) => (p.kind === "member" ? p.userId : p.guestId)),
      "Participantes",
    );
    unique(
      doc.items.map((i) => i.id),
      "Artículos",
    );
    unique(
      doc.taxes.map((t) => t.id),
      "Impuestos",
    );
    unique(
      doc.charges.map((c) => c.id),
      "Cargos",
    );
  });

export type ReceiptDocument = z.infer<typeof receiptDocumentSchema>;
export type DocumentParticipant = ReceiptDocument["participants"][number];
export type DocumentItem = ReceiptDocument["items"][number];
export type DocumentTax = ReceiptDocument["taxes"][number];
export type DocumentCharge = ReceiptDocument["charges"][number];
export type PaymentMethod = (typeof paymentMethods)[number];
export type Bbox = NonNullable<DocumentItem["bbox"]>;

export function emptyDocument(): ReceiptDocument {
  return {
    schemaVersion: 1,
    merchant: null,
    date: null,
    invoiceNumber: null,
    establishment: "restaurant_with_alcohol",
    printedTotalCents: null,
    participants: [],
    items: [],
    allocations: [],
    taxes: [],
    charges: [],
    payments: [],
    ocr: { status: "none" },
  };
}

/** Lee un documento guardado; si no es válido, devuelve uno vacío. */
export function readDocument(value: unknown): ReceiptDocument {
  const parsed = receiptDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : emptyDocument();
}

export function toEngineInput(doc: ReceiptDocument): ReceiptInput {
  return {
    participants: doc.participants.map((p) => ({ id: p.id, name: p.name })),
    items: doc.items as ReceiptItem[],
    allocations: doc.allocations as ItemAllocation[],
    taxes: doc.taxes as ReceiptTax[],
    charges: doc.charges as ReceiptCharge[],
    printedTotalCents: doc.printedTotalCents,
  };
}

export function toLedgerParticipants(
  doc: ReceiptDocument,
): LedgerParticipant[] {
  return doc.participants.map((p) =>
    p.kind === "member"
      ? { id: p.id, kind: "member", userId: p.userId }
      : { id: p.id, kind: "guest", guestId: p.guestId },
  );
}
