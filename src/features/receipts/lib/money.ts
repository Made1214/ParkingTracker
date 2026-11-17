/**
 * Aritmética monetaria de facturas. Todo importe es un entero en centavos;
 * nunca se usan flotantes para repartir. Los repartos usan BigInt por dentro
 * para que `importe × peso` no pierda precisión con números grandes.
 */

export type Cents = number;

export class MoneyError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MoneyError";
  }
}

export function assertCents(value: number, label = "importe"): Cents {
  if (!Number.isSafeInteger(value))
    throw new MoneyError(
      "not_integer_cents",
      `${label} debe ser un entero en centavos`,
    );
  return value;
}

export const sum = (values: readonly number[]) =>
  values.reduce((acc, value) => acc + value, 0);

/**
 * Reparte `total` según `weights` con el método del resto mayor (Hamilton):
 *   1. cada parte recibe floor(total × peso / Σpesos);
 *   2. los centavos sobrantes van, de uno en uno, a las partes con mayor
 *      fracción descartada;
 *   3. a igual fracción gana la parte con el índice menor (el orden de la
 *      lista, que el llamador fija de forma estable).
 * El resultado siempre suma exactamente `total`. Un total negativo (descuento,
 * devolución) se reparte en valor absoluto y se devuelve con signo.
 * Pesos con valor cero reciben cero.
 */
export function allocate(total: Cents, weights: readonly number[]): Cents[] {
  assertCents(total, "total");
  if (weights.length === 0) {
    if (total === 0) return [];
    throw new MoneyError("no_weights", "No hay a quién repartir el importe");
  }
  for (const weight of weights)
    if (!Number.isSafeInteger(weight) || weight < 0)
      throw new MoneyError(
        "invalid_weight",
        "Los pesos deben ser enteros no negativos",
      );
  const totalWeight = weights.reduce((acc, w) => acc + BigInt(w), BigInt(0));
  if (totalWeight === BigInt(0)) {
    if (total === 0) return weights.map(() => 0);
    throw new MoneyError("zero_weights", "Los pesos suman cero");
  }
  const sign = total < 0 ? -1 : 1;
  const amount = BigInt(Math.abs(total));
  const parts = weights.map((w, index) => {
    const numerator = amount * BigInt(w);
    return {
      index,
      base: numerator / totalWeight,
      fraction: numerator % totalWeight,
    };
  });
  let leftover = amount - parts.reduce((acc, p) => acc + p.base, BigInt(0));
  const order = [...parts].sort((a, b) =>
    a.fraction === b.fraction
      ? a.index - b.index
      : a.fraction > b.fraction
        ? -1
        : 1,
  );
  for (const part of order) {
    if (leftover === BigInt(0)) break;
    if (weights[part.index] === 0) continue;
    part.base += BigInt(1);
    leftover -= BigInt(1);
  }
  return parts.map((p) => {
    const value = Number(p.base) * sign;
    return value === 0 ? 0 : value; // evita -0
  });
}

export type ParsedAmount = {
  cents: Cents;
  /** true si el separador podía leerse como decimal o como miles. */
  ambiguous: boolean;
};

/**
 * Lee importes impresos en facturas: "12.50", "12,50", "1,234.56",
 * "1.234,56", "B/. 7.00", "-3.00", "(3.00)", "$4". Devuelve null si el texto
 * no es un importe legible; nunca adivina dígitos.
 * Un único separador seguido de exactamente 3 dígitos ("1,234") se trata como
 * miles pero se marca `ambiguous` para pedir confirmación.
 */
export function parseAmount(raw: string): ParsedAmount | null {
  let text = raw.trim().replace(/\s+/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/^(B\/\.?|USD|PAB|\$)/i, "");
  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1);
  }
  if (text.endsWith("-")) {
    negative = !negative;
    text = text.slice(0, -1);
  }
  text = text.replace(/^(B\/\.?|USD|PAB|\$)/i, "");
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const separators = [...text.matchAll(/[.,]/g)].map((m) => m.index!);
  let whole = text;
  let fraction = "";
  let ambiguous = false;
  if (separators.length > 0) {
    const last = separators[separators.length - 1];
    const tail = text.slice(last + 1);
    const distinct = new Set(separators.map((i) => text[i]));
    if (distinct.size === 2 || tail.length <= 2) {
      // El último separador es el decimal.
      if (tail.length === 0 || tail.length > 2) return null;
      fraction = tail;
      whole = text.slice(0, last);
      if (whole.includes(text[last])) return null;
      if (whole === "") whole = "0";
    } else if (tail.length === 3) {
      // "1,234" o "1.234.567": separador de miles.
      if (separators.length === 1) ambiguous = true;
    } else {
      return null;
    }
    const groupSeparator = /[.,]/.exec(whole)?.[0];
    if (groupSeparator) {
      const groups = whole.split(groupSeparator);
      if (
        groups[0].length === 0 ||
        groups[0].length > 3 ||
        groups.slice(1).some((g) => g.length !== 3) ||
        /[.,]/.test(groups.join(""))
      )
        return null;
      whole = groups.join("");
    }
  }
  if (!/^\d+$/.test(whole) || whole.length > 12) return null;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0") || "0");
  return { cents: negative && cents !== 0 ? -cents : cents, ambiguous };
}

/** 1234 → "B/.12.34"; −500 → "−B/.5.00". El balboa circula a la par del USD. */
export function formatBalboas(cents: Cents) {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}B/.${whole}.${String(abs % 100).padStart(2, "0")}`;
}

/** Tasa en puntos básicos (700 = 7 %) aplicada a una base, redondeo half-up. */
export function applyRate(base: Cents, rateBp: number): Cents {
  assertCents(base, "base");
  const numerator = BigInt(Math.abs(base)) * BigInt(rateBp);
  const value = Number((numerator + BigInt(5_000)) / BigInt(10_000));
  return base < 0 ? -value : value;
}
