import { formatBalboas, parseAmount, type Cents } from "../lib/money";

/** Ocho tonos distinguibles en claro y oscuro (clases .p0–.p7 del CSS). */
export const personTone = (index: number) => `p${index % 8}`;

export const money = (cents: Cents | null | undefined) =>
  cents === null || cents === undefined ? "—" : formatBalboas(cents);

/** Texto de un campo de importe → centavos; null si está vacío o ilegible. */
export function readMoney(value: string): Cents | null {
  if (!value.trim()) return null;
  return parseAmount(value)?.cents ?? null;
}

export const moneyInput = (cents: Cents | null | undefined) =>
  cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);

export const newId = () => crypto.randomUUID();

export function percentLabel(numerator: number, denominator: number) {
  if (numerator === denominator) return "100 %";
  const pct = (numerator / denominator) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return denominator <= 12 && Number.isInteger(denominator)
    ? `${numerator}/${denominator}`
    : `${rounded} %`;
}

export const LOW_CONFIDENCE = 0.7;
