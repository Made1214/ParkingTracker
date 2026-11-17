import { applyRate, parseAmount, type Cents } from "./money";
import type {
  Bbox,
  DocumentCharge,
  DocumentItem,
  DocumentTax,
} from "./document";

/**
 * Intérprete determinista de líneas OCR de facturas (formato panameño
 * habitual: ITBMS, B/., punto o coma decimal). No usa IA ni adivina: si un
 * importe no se lee, el campo queda en null y la revisión pide corregirlo.
 */

export type OcrLine = {
  text: string;
  /** 0..1 */
  confidence: number;
  bbox?: Bbox;
};

export type ParsedReceipt = {
  merchant: string | null;
  date: string | null;
  invoiceNumber: string | null;
  items: DocumentItem[];
  taxes: DocumentTax[];
  charges: DocumentCharge[];
  printedTotalCents: Cents | null;
  printedTotalConfidence: number;
  subtotalCents: Cents | null;
  warnings: string[];
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/** Importe al final de la línea (permite B/., $, signo y paréntesis). */
const AMOUNT_TAIL =
  /(?:^|\s)(\(?-?\s?(?:B\/\.?|\$)?\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\)?-?|\(?-?\s?(?:B\/\.?|\$)?\s?\d+(?:[.,]\d{1,2})?\)?-?)\s*$/i;
/** Termina en algo con dígitos que no es un importe legible ("1?.0O"). */
const GARBLED_TAIL = /\s[\dOIl?$B/.,()-]*\d[\dOIl?$B/.,()-]*$/;

const SKIP =
  /\b(RUC|D\.?V\.?|CAJERO|CAJA|MESA|MESERO|SALONERO|TEL|TELEFONO|CLIENTE|CEDULA|VISA|MASTERCARD|AMEX|TARJETA|EFECTIVO|CAMBIO|VUELTO|YAPPY|AUTORIZACION|AUT|REF|GRACIAS|CANT|DESCRIPCION|ARTICULOS|ITEMS|HORA|ORDEN|TICKET|CUFE|PROTOCOLO|SERIE|NUMERO DE)\b/;
const TOTAL =
  /^(TOTAL|TOTAL A PAGAR|TOTAL GENERAL|GRAN TOTAL|IMPORTE TOTAL|TOTAL B\/?\.?)\b(?!.*\b(ITBMS|IMPUESTO|DESC|ARTICULOS|ITEMS)\b)/;
const SUBTOTAL = /^SUB[\s-]?TOTAL\b/;
const TAX = /\b(ITBMS|I\.T\.B\.M\.S|IMPUESTO|IVA|TAX)\b/;
const TAX_BASE = /\b(GRAVADO|BASE|EXENTO|EXENTA|NO GRAVADO)\b/;
const TIP = /\b(PROPINA|TIP|GRATUITY)\b/;
const SERVICE = /\b(CARGO POR SERVICIO|SERVICIO|SERVICE)\b/;
const SUGGESTED = /\b(SUGERIDA|SUGERIDO|SUGGESTED|OPCIONAL|VOLUNTARIA)\b/;
const DISCOUNT = /\b(DESC|DESCUENTO|DCTO|DSCTO|PROMO|PROMOCION|CORTESIA)\b/;
const RETURN = /\b(DEVOLUCION|ANULACION|ANULADO|VOID)\b/;

const ALCOHOL =
  /\b(CERVEZA|BEER|VINO|WINE|BOTELLA|WHISKY|WHISKEY|RON|SECO|VODKA|TEQUILA|GIN|MOJITO|MICHELADA|SANGRIA|COCTEL|COCKTAIL|TRAGO|SHOT|BALBOA|ATLAS|PANAMA LIGHT|SOBERANA|HEINEKEN|CORONA|BUCKET|CUBETAZO|PINTA|CHAMPAGNE|ESPUMANTE)\b/;
const SOFT_DRINK =
  /\b(SODA|COCA|PEPSI|JUGO|AGUA|CAFE|TE|LIMONADA|REFRESCO|BATIDO|CHICHA|MALTA|TEA|COFFEE|JUICE)\b/;

function tailAmount(text: string) {
  const match = AMOUNT_TAIL.exec(text);
  if (!match) return null;
  const parsed = parseAmount(match[1]);
  if (!parsed) return null;
  return { ...parsed, rest: text.slice(0, match.index).trim() };
}

function parseDate(text: string): string | null {
  const iso = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
  const dmy = /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/.exec(text);
  let y: number, m: number, d: number;
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmy) {
    [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
    if (y < 100) y += 2000;
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    return null;
  return date.toISOString().slice(0, 10);
}

export function guessCategory(name: string): DocumentItem["category"] {
  const text = normalize(name);
  if (ALCOHOL.test(text)) return "alcoholic_beverage";
  if (SOFT_DRINK.test(text)) return "non_alcoholic_beverage";
  return "food";
}

const round = (n: number) => Math.round(n * 100) / 100;

export function parseReceiptLines(lines: OcrLine[]): ParsedReceipt {
  const result: ParsedReceipt = {
    merchant: null,
    date: null,
    invoiceNumber: null,
    items: [],
    taxes: [],
    charges: [],
    printedTotalCents: null,
    printedTotalConfidence: 0,
    subtotalCents: null,
    warnings: [],
  };
  let inTotals = false;
  let n = 0;
  const nextId = (prefix: string) => `${prefix}${++n}`;

  lines.forEach((line, index) => {
    const raw = line.text.trim();
    const text = normalize(raw);
    if (!text) return;
    const conf = Math.max(0, Math.min(1, line.confidence));
    const bbox = line.bbox;

    if (!result.date) {
      const date = parseDate(text);
      if (date) {
        result.date = date;
        return;
      }
    }
    const invoice =
      /\b(FACTURA|FACT|NO\.? FACTURA|COMPROBANTE)\b[^\d]*([\w-]*\d[\w-]*)/.exec(
        text,
      );
    if (invoice && !result.invoiceNumber) {
      result.invoiceNumber = invoice[2];
      return;
    }

    const amount = tailAmount(raw);
    const lowConf = (extra = 1) =>
      round(conf * extra * (amount?.ambiguous ? 0.5 : 1));

    if (SUBTOTAL.test(text)) {
      inTotals = true;
      if (amount) result.subtotalCents = amount.cents;
      return;
    }
    if (TOTAL.test(text)) {
      inTotals = true;
      // La última línea TOTAL manda (algunas facturas repiten el total).
      result.printedTotalCents = amount ? Math.abs(amount.cents) : null;
      result.printedTotalConfidence = amount ? lowConf() : 0;
      return;
    }
    if (TAX.test(text)) {
      inTotals = true;
      if (TAX_BASE.test(text)) return;
      // "ITBMS 7%" o, si el OCR perdió el "%", "ITBMS 7" (nunca un importe).
      const label = normalize(amount ? amount.rest : raw);
      const rate =
        /(\d{1,2})(?:[.,]\d+)?\s*%/.exec(label) ??
        /\b(?:ITBMS|IMPUESTO|IVA|TAX)\s+(\d{1,2})$/.exec(label);
      result.taxes.push({
        id: nextId("tax"),
        label: raw.replace(AMOUNT_TAIL, "").trim() || "Impuesto",
        amountCents: amount ? Math.abs(amount.cents) : null,
        rateBp:
          rate && Number(rate[1]) > 0 && Number(rate[1]) <= 25
            ? Number(rate[1]) * 100
            : null,
        included: false,
        base: "items",
        confidence: lowConf(),
        bbox,
      });
      return;
    }
    if (TIP.test(text) || SERVICE.test(text)) {
      inTotals = true;
      const suggested = SUGGESTED.test(text);
      result.charges.push({
        id: nextId("chg"),
        label: raw.replace(AMOUNT_TAIL, "").trim() || "Propina",
        kind: TIP.test(text) ? "tip" : "service_charge",
        amountCents: amount ? Math.abs(amount.cents) : null,
        status: suggested ? "suggested" : "paid",
        split: { method: "proportional" },
        // Una propina siempre se confirma: puede ser sugerida o pagada.
        confidence: lowConf(0.8),
        bbox,
      });
      return;
    }
    if (DISCOUNT.test(text) && amount) {
      const value = Math.abs(amount.cents);
      const previous = result.items[result.items.length - 1];
      if (!inTotals && previous && previous.lineTotalCents !== null) {
        previous.discountCents = (previous.discountCents ?? 0) + value;
        previous.confidence = Math.min(previous.confidence ?? 1, lowConf(0.8));
      } else {
        result.charges.push({
          id: nextId("chg"),
          label: raw.replace(AMOUNT_TAIL, "").trim() || "Descuento",
          kind: "discount",
          amountCents: -value,
          status: "paid",
          split: { method: "proportional" },
          confidence: lowConf(0.8),
          bbox,
        });
      }
      return;
    }
    if (SKIP.test(text) || inTotals) return;

    const letters = (text.match(/[A-Z]/g) ?? []).length;
    if (!amount) {
      // Encabezado: primera línea con texto antes de cualquier artículo.
      if (
        !result.merchant &&
        result.items.length === 0 &&
        letters >= 3 &&
        index < 6
      ) {
        result.merchant = raw.slice(0, 120);
        return;
      }
      // Parece un artículo con precio ilegible: no se inventa el importe.
      if (result.items.length > 0 && letters >= 3 && GARBLED_TAIL.test(raw)) {
        result.items.push({
          id: nextId("item"),
          name:
            raw.replace(GARBLED_TAIL, "").trim().slice(0, 120) || "Artículo",
          quantity: 1,
          unitPriceCents: null,
          lineTotalCents: null,
          confidence: 0,
          bbox,
        });
      }
      return;
    }
    if (letters < 2) return;

    let rest = amount.rest;
    let quantity = 1;
    let unitPriceCents: Cents | null = null;
    const unit = tailAmount(rest);
    if (unit && unit.rest && /[A-Z]/i.test(unit.rest)) {
      unitPriceCents = Math.abs(unit.cents);
      rest = unit.rest.replace(/\s*[@xX×]\s*$/, "");
    }
    const qty = /^(\d{1,3})\s*(?:[xX×]\s*)?(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/.exec(rest);
    if (qty) {
      quantity = Math.max(1, Number(qty[1]));
      rest = rest.slice(qty[0].length);
    } else {
      const trailingQty = /\s(\d{1,3})\s*[@xX×]?$/.exec(rest);
      if (trailingQty && unitPriceCents !== null) {
        quantity = Math.max(1, Number(trailingQty[1]));
        rest = rest.slice(0, trailingQty.index);
      }
    }
    const negative = amount.cents < 0 || RETURN.test(text);
    const lineTotal = negative ? -Math.abs(amount.cents) : amount.cents;
    if (unitPriceCents === null && quantity > 1 && lineTotal % quantity === 0)
      unitPriceCents = Math.abs(lineTotal) / quantity;
    const consistent =
      unitPriceCents === null ||
      unitPriceCents * quantity === Math.abs(lineTotal);
    const name =
      rest
        .replace(/^[-*·.\s]+/, "")
        .trim()
        .slice(0, 120) || "Artículo";
    result.items.push({
      id: nextId("item"),
      name,
      quantity,
      unitPriceCents:
        negative && unitPriceCents ? -unitPriceCents : unitPriceCents,
      lineTotalCents: lineTotal,
      category: guessCategory(name),
      confidence: lowConf(consistent ? 1 : 0.5),
      bbox,
    });
  });

  assignTaxBases(result);
  validate(result);
  return result;
}

/**
 * Propone a qué artículos aplica cada impuesto. Con una sola línea, a todos.
 * Con varias tasas, el alcohol va a la tasa mayor y el resto a la menor, y
 * se avisa para que la persona lo confirme.
 */
function assignTaxBases(result: ParsedReceipt) {
  const taxes = result.taxes.filter((t) => t.amountCents !== 0);
  if (taxes.length === 0) return;
  if (taxes.length === 1) {
    for (const item of result.items) item.taxId = taxes[0].id;
    return;
  }
  const byRate = [...taxes]
    .filter((t) => t.rateBp)
    .sort((a, b) => (a.rateBp ?? 0) - (b.rateBp ?? 0));
  if (byRate.length >= 2) {
    const low = byRate[0];
    const high = byRate[byRate.length - 1];
    for (const item of result.items)
      item.taxId = item.category === "alcoholic_beverage" ? high.id : low.id;
    for (const tax of [low, high]) {
      const base = result.items
        .filter((i) => i.taxId === tax.id)
        .reduce(
          (a, i) => a + (i.lineTotalCents ?? 0) - (i.discountCents ?? 0),
          0,
        );
      if (
        tax.amountCents !== null &&
        tax.rateBp &&
        Math.abs(applyRate(base, tax.rateBp) - tax.amountCents) > 2
      )
        tax.confidence = Math.min(tax.confidence ?? 1, 0.4);
    }
  }
  result.warnings.push(
    "La factura tiene varias líneas de impuesto: confirma a qué artículos aplica cada una.",
  );
}

function validate(result: ParsedReceipt) {
  const items = result.items.reduce(
    (a, i) => a + (i.lineTotalCents ?? 0) - (i.discountCents ?? 0),
    0,
  );
  if (result.items.some((i) => i.lineTotalCents === null))
    result.warnings.push("Hay precios que no se pudieron leer.");
  if (result.subtotalCents !== null && result.subtotalCents !== items)
    result.warnings.push(
      "La suma de los artículos no coincide con el subtotal impreso.",
    );
  if (result.printedTotalCents === null)
    result.warnings.push("No se encontró el total de la factura.");
  if (result.items.length === 0)
    result.warnings.push("No se reconocieron artículos.");
}
