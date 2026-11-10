import { z } from "zod";
import { text } from "@/shared/lib/forms";

export const categories = [
  { value: "comida", label: "Comida" },
  { value: "transporte", label: "Transporte" },
  { value: "alojamiento", label: "Alojamiento" },
  { value: "entradas", label: "Entradas" },
  { value: "compras", label: "Compras" },
  { value: "otro", label: "Otro" },
] as const;
export type Category = (typeof categories)[number]["value"];

/** "36", "36.5", "36,50" → 3650 centavos. null si no es un monto válido. */
export function toCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Monto de la base de datos (numeric, puede ser negativo) → centavos. */
export function amountToCents(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function formatMoney(cents: number) {
  const sign = cents < 0 ? "−" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** Reparte en partes iguales sin perder centavos: el resto va a los primeros. */
export function equalShares(totalCents: number, people: string[]) {
  const base = Math.floor(totalCents / people.length);
  const remainder = totalCents - base * people.length;
  return people.map((userId, index) => ({
    userId,
    cents: base + (index < remainder ? 1 : 0),
  }));
}

const ids = z.object({
  group_id: z.guid(),
  event_id: z.guid(),
  paid_by: z.guid(),
});

export type ExpenseInput = {
  group_id: string;
  event_id: string;
  description: string;
  amount: number;
  paid_by: string;
  category: Category;
  shares: { user_id: string; amount: number }[];
};

/** Valida el formulario de gasto (reparto igual o personalizado). */
export function parseExpenseForm(
  form: FormData,
): { data: ExpenseInput } | { error: string } {
  const parsedIds = ids.safeParse({
    group_id: text(form, "group_id"),
    event_id: text(form, "event_id"),
    paid_by: text(form, "paid_by"),
  });
  if (!parsedIds.success) return { error: "Elige quién pagó." };
  const description = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .safeParse(text(form, "description"));
  if (!description.success)
    return { error: "Describe el gasto en 200 caracteres o menos." };
  const total = toCents(text(form, "amount"));
  if (!total) return { error: "Escribe un monto mayor que cero." };
  const category = categories.find((c) => c.value === text(form, "category"));
  const participants = [
    ...new Set(form.getAll("participants").map(String)),
  ].filter((id) => z.guid().safeParse(id).success);
  if (!participants.length)
    return { error: "Elige al menos una persona para repartir." };

  let shares: { userId: string; cents: number }[];
  if (text(form, "split") === "custom") {
    shares = participants.map((userId) => ({
      userId,
      cents: toCents(text(form, `share_${userId}`)) ?? -1,
    }));
    if (shares.some((share) => share.cents <= 0))
      return {
        error: "Cada persona elegida necesita un monto mayor que cero.",
      };
    const sum = shares.reduce((acc, share) => acc + share.cents, 0);
    if (sum !== total)
      return {
        error: `Los montos suman ${formatMoney(sum)} y el gasto es ${formatMoney(total)}.`,
      };
  } else {
    shares = equalShares(total, participants);
    if (shares.some((share) => share.cents <= 0))
      return { error: "El monto es muy pequeño para repartirlo." };
  }

  return {
    data: {
      ...parsedIds.data,
      description: description.data,
      amount: total / 100,
      category: category?.value ?? "otro",
      shares: shares.map((share) => ({
        user_id: share.userId,
        amount: share.cents / 100,
      })),
    },
  };
}

/** Traduce los errores de la base de datos de gastos a mensajes claros. */
export function expenseError(code?: string, message?: string) {
  if (message?.includes("must add up")) return "Los montos no suman el total.";
  if (message?.includes("payer must"))
    return "Quien pagó tiene que ser del grupo.";
  if (message?.includes("participant must"))
    return "Solo puedes repartir entre miembros del grupo.";
  if (message?.includes("cancelled"))
    return "La salida está cancelada: ya no admite gastos.";
  if (code === "42501") return "No tienes permiso para hacer esto.";
  return "No se pudo guardar. Inténtalo de nuevo.";
}
