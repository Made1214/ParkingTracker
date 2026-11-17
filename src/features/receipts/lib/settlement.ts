import { sum, type Cents } from "./money";

/**
 * Pagos, reembolsos y balances netos de una factura ya repartida.
 *
 *   neto = pagado − consumido + reembolsos enviados − reembolsos recibidos
 *
 * neto > 0: le deben; neto < 0: debe; 0: liquidado. La suma de netos es 0.
 */

export type Payment = { participantId: string; cents: Cents };
export type Reimbursement = { fromId: string; toId: string; cents: Cents };
export type Transfer = { fromId: string; toId: string; cents: Cents };

export type BalanceStatus = "settled" | "owes" | "is_owed";

export type ParticipantBalance = {
  participantId: string;
  /** Consumo atribuible (total personal de la factura). */
  consumedCents: Cents;
  /** Dinero adelantado al comercio. */
  paidCents: Cents;
  reimbursementsSentCents: Cents;
  reimbursementsReceivedCents: Cents;
  netCents: Cents;
  status: BalanceStatus;
};

export type SettlementResult =
  | { ok: false; error: string }
  | {
      ok: true;
      balances: ParticipantBalance[];
      /** Transferencias mínimas pendientes para liquidar todo. */
      transfers: Transfer[];
      warnings: string[];
    };

export function computeSettlement(
  order: string[],
  consumed: Map<string, Cents> | Record<string, Cents>,
  payments: Payment[],
  reimbursements: Reimbursement[] = [],
): SettlementResult {
  const owed =
    consumed instanceof Map ? consumed : new Map(Object.entries(consumed));
  const known = new Set(order);
  const total = sum([...owed.values()]);
  const paid = sum(payments.map((p) => p.cents));

  for (const p of payments) {
    if (!known.has(p.participantId))
      return {
        ok: false,
        error: "Hay un pagador que no participa en la factura.",
      };
    if (!Number.isSafeInteger(p.cents) || p.cents <= 0)
      return { ok: false, error: "Cada pago debe ser mayor que cero." };
  }
  if (payments.length === 0)
    return { ok: false, error: "Indica quién pagó la factura." };
  if (paid !== total)
    return {
      ok: false,
      error: `Los pagos suman ${paid} centavos y la factura ${total}.`,
    };
  for (const r of reimbursements) {
    if (!known.has(r.fromId) || !known.has(r.toId) || r.fromId === r.toId)
      return { ok: false, error: "Reembolso entre personas no válidas." };
    if (!Number.isSafeInteger(r.cents) || r.cents <= 0)
      return { ok: false, error: "Cada reembolso debe ser mayor que cero." };
  }

  const balances = order.map((participantId): ParticipantBalance => {
    const consumedCents = owed.get(participantId) ?? 0;
    const paidCents = sum(
      payments
        .filter((p) => p.participantId === participantId)
        .map((p) => p.cents),
    );
    const sent = sum(
      reimbursements
        .filter((r) => r.fromId === participantId)
        .map((r) => r.cents),
    );
    const received = sum(
      reimbursements
        .filter((r) => r.toId === participantId)
        .map((r) => r.cents),
    );
    const netCents = paidCents - consumedCents + sent - received;
    return {
      participantId,
      consumedCents,
      paidCents,
      reimbursementsSentCents: sent,
      reimbursementsReceivedCents: received,
      netCents,
      status: netCents === 0 ? "settled" : netCents > 0 ? "is_owed" : "owes",
    };
  });

  const warnings: string[] = [];
  for (const b of balances) {
    const consumedOrPaid = b.paidCents - b.consumedCents;
    // Quien debía y ahora tiene saldo a favor pagó de más en reembolsos.
    if (consumedOrPaid < 0 && b.netCents > 0)
      warnings.push(`${b.participantId} reembolsó más de lo que debía.`);
  }

  return {
    ok: true,
    balances,
    transfers: minimalTransfers(balances),
    warnings,
  };
}

/**
 * Algoritmo voraz de flujo mínimo: el mayor deudor paga al mayor acreedor.
 * Empates por orden de participantes, para que sea reproducible. Produce a lo
 * sumo n − 1 transferencias y nunca reembolsos circulares.
 */
export function minimalTransfers(balances: ParticipantBalance[]): Transfer[] {
  const index = new Map(balances.map((b, i) => [b.participantId, i]));
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ id: b.participantId, cents: b.netCents }));
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ id: b.participantId, cents: -b.netCents }));
  const byAmount = (a: { id: string; cents: number }, b: typeof a) =>
    b.cents - a.cents || index.get(a.id)! - index.get(b.id)!;
  const transfers: Transfer[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort(byAmount);
    debtors.sort(byAmount);
    const c = creditors[0];
    const d = debtors[0];
    const cents = Math.min(c.cents, d.cents);
    transfers.push({ fromId: d.id, toId: c.id, cents });
    c.cents -= cents;
    d.cents -= cents;
    if (c.cents === 0) creditors.shift();
    if (d.cents === 0) debtors.shift();
  }
  return transfers;
}

/**
 * Vista de finanzas personales de una persona. Separa flujo de caja, gasto
 * atribuible y cuentas por cobrar/pagar: un reembolso recibido reduce lo
 * pendiente de cobrar, nunca es un ingreso.
 */
export function personalFinanceView(balance: ParticipantBalance) {
  return {
    /** Dinero que salió de su bolsillo (al comercio + reembolsos enviados). */
    cashOutCents: balance.paidCents + balance.reimbursementsSentCents,
    /** Dinero que volvió (reembolsos), no clasificable como ingreso. */
    cashInCents: balance.reimbursementsReceivedCents,
    /** Gasto personal real, independiente de quién pagó. */
    attributableExpenseCents: balance.consumedCents,
    receivableCents: Math.max(0, balance.netCents),
    payableCents: Math.max(0, -balance.netCents),
  };
}
