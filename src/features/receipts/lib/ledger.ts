import type { Cents } from "./money";

/**
 * Convierte una factura repartida en gastos del modelo existente: un gasto
 * por pagador, con partes de miembros (`expense_splits`) y de invitados
 * (`expense_guest_shares`). Reglas:
 *
 *   - Σ partes de cada gasto = lo que pagó ese pagador.
 *   - Σ partes de cada persona (en todos los gastos) = su total consumido.
 *
 * Así los saldos que calcula la base de datos coinciden al centavo con el
 * reparto. Primero cada pagador cubre su propio consumo (no genera deuda);
 * el resto se asigna en orden (esquina noroeste), de forma determinista.
 * Solo los miembros pueden pagar: los invitados no tienen cuenta.
 */

export type LedgerParticipant =
  | { id: string; kind: "member"; userId: string }
  | { id: string; kind: "guest"; guestId: string };

export type ReceiptExpense = {
  paid_by: string;
  amount_cents: Cents;
  splits: { user_id: string; amount_cents: Cents }[];
  guest_shares: { guest_id: string; amount_cents: Cents }[];
};

export type LedgerResult =
  { ok: true; expenses: ReceiptExpense[] } | { ok: false; error: string };

export function buildReceiptExpenses(
  participants: LedgerParticipant[],
  consumed: ReadonlyMap<string, Cents>,
  payments: { participantId: string; cents: Cents }[],
): LedgerResult {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const paid = new Map<string, Cents>();
  for (const payment of payments) {
    const payer = byId.get(payment.participantId);
    if (!payer) return { ok: false, error: "Hay un pagador desconocido." };
    if (payer.kind !== "member")
      return {
        ok: false,
        error: "Solo los miembros del grupo pueden registrar un pago.",
      };
    if (!Number.isSafeInteger(payment.cents) || payment.cents <= 0)
      return { ok: false, error: "Cada pago debe ser mayor que cero." };
    paid.set(payer.id, (paid.get(payer.id) ?? 0) + payment.cents);
  }
  if (paid.size === 0)
    return { ok: false, error: "Indica quién pagó la factura." };

  const remaining = new Map<string, Cents>();
  for (const p of participants) {
    const cents = consumed.get(p.id) ?? 0;
    if (cents < 0)
      return {
        ok: false,
        error:
          "Una persona quedó con total negativo. Reparte la devolución entre quienes consumieron.",
      };
    remaining.set(p.id, cents);
  }
  const totalConsumed = [...remaining.values()].reduce((a, b) => a + b, 0);
  const totalPaid = [...paid.values()].reduce((a, b) => a + b, 0);
  if (totalConsumed !== totalPaid)
    return {
      ok: false,
      error: `Los pagos suman ${totalPaid} centavos y la factura ${totalConsumed}.`,
    };

  const payers = participants.filter((p) => paid.has(p.id));
  const cells = new Map<string, Map<string, Cents>>(
    payers.map((p) => [p.id, new Map()]),
  );
  const capacity = new Map(paid);
  const move = (payerId: string, personId: string, cents: Cents) => {
    if (cents <= 0) return;
    const row = cells.get(payerId)!;
    row.set(personId, (row.get(personId) ?? 0) + cents);
    capacity.set(payerId, capacity.get(payerId)! - cents);
    remaining.set(personId, remaining.get(personId)! - cents);
  };
  for (const payer of payers)
    move(
      payer.id,
      payer.id,
      Math.min(capacity.get(payer.id)!, remaining.get(payer.id)!),
    );
  for (const payer of payers)
    for (const person of participants)
      move(
        payer.id,
        person.id,
        Math.min(capacity.get(payer.id)!, remaining.get(person.id)!),
      );

  const expenses = payers.map((payer): ReceiptExpense => {
    const splits: ReceiptExpense["splits"] = [];
    const guestShares: ReceiptExpense["guest_shares"] = [];
    for (const person of participants) {
      const cents = cells.get(payer.id)!.get(person.id) ?? 0;
      if (cents === 0) continue;
      if (person.kind === "member")
        splits.push({ user_id: person.userId, amount_cents: cents });
      else guestShares.push({ guest_id: person.guestId, amount_cents: cents });
    }
    return {
      paid_by: (payer as { userId: string }).userId,
      amount_cents: paid.get(payer.id)!,
      splits,
      guest_shares: guestShares,
    };
  });
  return { ok: true, expenses };
}
