import type { ReceiptItem } from "./engine";
import type { Cents } from "./money";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Grupos de líneas con el mismo nombre normalizado. Cada línea conserva su
 * identidad: solo se avisa, nunca se fusionan automáticamente.
 */
export function findRepeatedItems(items: ReceiptItem[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const key = normalize(item.name);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), item.id]);
  }
  return [...groups.values()].filter((ids) => ids.length > 1);
}

/**
 * Huella para detectar la misma factura registrada dos veces: comercio,
 * fecha, total y, si existe, el número de factura impreso. Se guarda en la
 * base de datos con un índice único por propietario.
 */
export function receiptFingerprint(input: {
  merchant: string;
  /** YYYY-MM-DD */
  date: string;
  totalCents: Cents;
  invoiceNumber?: string | null;
}) {
  return [
    normalize(input.merchant),
    input.date,
    String(input.totalCents),
    normalize(input.invoiceNumber ?? ""),
  ].join("|");
}
