import { allocate, applyRate, assertCents, sum, type Cents } from "./money";

/**
 * Motor de reparto de facturas. Función pura y determinista: la misma
 * entrada produce siempre los mismos centavos. Política de redondeo en
 * `allocate` (resto mayor, empates por orden de participantes).
 *
 * Orden de cálculo (documentado en docs/receipts/DECISIONS.md):
 *   1. Cada artículo (neto de su descuento) se reparte según su asignación.
 *   2. Descuentos globales: proporcionales al consumo de artículos.
 *   3. Impuestos agregados: cada línea de impuesto impresa se reparte en
 *      proporción a la parte de su base imponible que consumió cada persona.
 *   4. Propinas, cargos y ajustes pagados: según su regla de reparto.
 * Los impuestos incluidos en el precio no suman al total; solo se informan.
 */

export type Participant = { id: string; name: string };

export type ReceiptItem = {
  id: string;
  name: string;
  /** Unidades enteras (≥ 1). */
  quantity: number;
  unitPriceCents: Cents | null;
  /** Importe impreso de la línea antes del descuento propio. null = ilegible. */
  lineTotalCents: Cents | null;
  /** Descuento propio del artículo, en positivo. */
  discountCents?: Cents;
  /** Línea de impuesto (ReceiptTax.id) a cuya base pertenece. */
  taxId?: string | null;
};

export type Share = { participantId: string; value: number };

export type ItemAllocation =
  | { itemId: string; mode: "equal"; participantIds: string[] }
  /** value = unidades; deben sumar la cantidad del artículo. */
  | { itemId: string; mode: "units"; shares: Share[] }
  /** value = puntos básicos; deben sumar 10 000. */
  | { itemId: string; mode: "percent"; shares: Share[] }
  /** value = centavos; deben sumar el neto del artículo. */
  | { itemId: string; mode: "amount"; shares: Share[] };

export type ReceiptTax = {
  id: string;
  label: string;
  /** Importe impreso. null = ilegible (bloquea el cierre). */
  amountCents: Cents | null;
  rateBp?: number | null;
  /** true si los precios ya lo incluyen (no se suma al total). */
  included: boolean;
  /**
   * "items": la base son los artículos con `taxId` igual a esta línea.
   * "all_items": el impuesto solo aparece a nivel de factura y la persona
   * confirmó repartirlo sobre todo el consumo.
   */
  base: "items" | "all_items";
};

export type SplitRule =
  | {
      method: "proportional";
      basis?: "items" | "items_plus_tax";
      participantIds?: string[];
    }
  | { method: "equal"; participantIds?: string[] }
  | { method: "custom"; shares: Share[] };

export type ChargeKind =
  "discount" | "tip" | "service_charge" | "other_charge" | "adjustment";

export type ReceiptCharge = {
  id: string;
  label: string;
  kind: ChargeKind;
  /** Con signo: los descuentos son negativos. null = ilegible. */
  amountCents: Cents | null;
  /** "suggested": propina sugerida no cobrada; nunca suma al total. */
  status: "paid" | "suggested";
  split: SplitRule;
};

export type ReceiptInput = {
  participants: Participant[];
  items: ReceiptItem[];
  allocations: ItemAllocation[];
  taxes: ReceiptTax[];
  charges: ReceiptCharge[];
  /** Total impreso. null = ilegible. */
  printedTotalCents: Cents | null;
};

export type IssueCode =
  | "unreadable_price"
  | "line_mismatch"
  | "invalid_quantity"
  | "unassigned_item"
  | "invalid_allocation"
  | "unknown_participant"
  | "unreadable_tax"
  | "tax_without_base"
  | "tax_rate_mismatch"
  | "unreadable_charge"
  | "invalid_charge_sign"
  | "invalid_charge_split"
  | "missing_printed_total"
  | "total_mismatch"
  | "no_participants";

export type Issue = {
  code: IssueCode;
  severity: "error" | "warning";
  message: string;
  ref?: string;
};

export type PersonLine = {
  itemId: string;
  name: string;
  cents: Cents;
  numerator: number;
  denominator: number;
  shared: boolean;
};

export type PersonShare = {
  participantId: string;
  lines: PersonLine[];
  itemsCents: Cents;
  discountsCents: Cents;
  taxes: { taxId: string; cents: Cents }[];
  taxCents: Cents;
  includedTaxCents: Cents;
  tipCents: Cents;
  chargesCents: Cents;
  adjustmentsCents: Cents;
  totalCents: Cents;
};

export type ReceiptResult = {
  people: PersonShare[];
  issues: Issue[];
  canFinalize: boolean;
  totals: {
    itemsCents: Cents;
    assignedItemsCents: Cents;
    unassignedItemsCents: Cents;
    discountsCents: Cents;
    addedTaxCents: Cents;
    includedTaxCents: Cents;
    tipCents: Cents;
    suggestedTipCents: Cents;
    chargesCents: Cents;
    adjustmentsCents: Cents;
    computedTotalCents: Cents;
    printedTotalCents: Cents | null;
    /** printed − computed; 0 cuando concilia. */
    differenceCents: Cents | null;
  };
};

export function itemNetCents(item: ReceiptItem): Cents | null {
  if (item.lineTotalCents === null) return null;
  return item.lineTotalCents - (item.discountCents ?? 0);
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export function computeReceipt(input: ReceiptInput): ReceiptResult {
  const issues: Issue[] = [];
  const error = (code: IssueCode, message: string, ref?: string) =>
    issues.push({ code, severity: "error", message, ref });
  const warn = (code: IssueCode, message: string, ref?: string) =>
    issues.push({ code, severity: "warning", message, ref });

  const order = new Map(input.participants.map((p, i) => [p.id, i]));
  if (input.participants.length === 0)
    error("no_participants", "Agrega al menos una persona.");

  const people = new Map<string, PersonShare>(
    input.participants.map((p) => [
      p.id,
      {
        participantId: p.id,
        lines: [],
        itemsCents: 0,
        discountsCents: 0,
        taxes: [],
        taxCents: 0,
        includedTaxCents: 0,
        tipCents: 0,
        chargesCents: 0,
        adjustmentsCents: 0,
        totalCents: 0,
      },
    ]),
  );
  const ids = () => input.participants.map((p) => p.id);
  /** Importe neto de artículos por persona, por línea de impuesto. */
  const itemsByTax = new Map<string, Map<string, Cents>>();
  const addItemsByTax = (taxId: string, pid: string, cents: Cents) => {
    const map = itemsByTax.get(taxId) ?? new Map<string, Cents>();
    map.set(pid, (map.get(pid) ?? 0) + cents);
    itemsByTax.set(taxId, map);
  };

  // ---- 1. Artículos ----------------------------------------------------
  const allocationsByItem = new Map<string, ItemAllocation[]>();
  for (const a of input.allocations)
    allocationsByItem.set(a.itemId, [
      ...(allocationsByItem.get(a.itemId) ?? []),
      a,
    ]);

  let itemsCents = 0;
  let assignedItemsCents = 0;
  for (const item of input.items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1)
      error(
        "invalid_quantity",
        `Revisa la cantidad de «${item.name}».`,
        item.id,
      );
    const net = itemNetCents(item);
    if (net === null) {
      error(
        "unreadable_price",
        `No se pudo leer el precio de «${item.name}». Escríbelo.`,
        item.id,
      );
      continue;
    }
    assertCents(net, item.name);
    itemsCents += net;
    if (
      item.unitPriceCents !== null &&
      item.lineTotalCents !== null &&
      Number.isSafeInteger(item.quantity) &&
      item.unitPriceCents * item.quantity !== item.lineTotalCents
    )
      error(
        "line_mismatch",
        `«${item.name}»: ${item.quantity} × precio unitario no coincide con el importe de la línea.`,
        item.id,
      );

    const allocations = allocationsByItem.get(item.id) ?? [];
    if (allocations.length === 0) {
      error(
        "unassigned_item",
        `«${item.name}» no tiene a nadie asignado.`,
        item.id,
      );
      continue;
    }
    if (allocations.length > 1) {
      error(
        "invalid_allocation",
        `«${item.name}» tiene más de una asignación.`,
        item.id,
      );
      continue;
    }
    const weights = allocationWeights(allocations[0], item, net, order);
    if ("error" in weights) {
      error(weights.code, weights.error, item.id);
      continue;
    }
    const totalWeight = sum(weights.map((w) => w.weight));
    const parts = allocate(
      net,
      weights.map((w) => w.weight),
    );
    weights.forEach(({ participantId, weight }, i) => {
      const person = people.get(participantId)!;
      const divisor = gcd(weight, totalWeight) || 1;
      person.lines.push({
        itemId: item.id,
        name: item.name,
        cents: parts[i],
        numerator: weight / divisor,
        denominator: totalWeight / divisor,
        shared: weights.length > 1,
      });
      person.itemsCents += parts[i];
      if (item.taxId) addItemsByTax(item.taxId, participantId, parts[i]);
      addItemsByTax("*", participantId, parts[i]);
    });
    assignedItemsCents += net;
  }

  const itemShare = (pid: string) => people.get(pid)!.itemsCents;

  // ---- 2. Descuentos globales -----------------------------------------
  const charges = input.charges.filter((c) => c.status === "paid");
  let discountsCents = 0;
  for (const charge of charges.filter((c) => c.kind === "discount"))
    discountsCents += applyCharge(charge, "discountsCents");

  // ---- 3. Impuestos ----------------------------------------------------
  let addedTaxCents = 0;
  let includedTaxCents = 0;
  for (const tax of input.taxes) {
    if (tax.amountCents === null) {
      error(
        "unreadable_tax",
        `No se pudo leer «${tax.label}». Escribe el importe impreso.`,
        tax.id,
      );
      continue;
    }
    assertCents(tax.amountCents, tax.label);
    if (tax.included) includedTaxCents += tax.amountCents;
    else addedTaxCents += tax.amountCents;

    const baseKey = tax.base === "all_items" ? "*" : tax.id;
    const base = itemsByTax.get(baseKey);
    const pids = ids().filter((pid) => (base?.get(pid) ?? 0) > 0);
    const baseItems = input.items.filter((item) =>
      tax.base === "all_items" ? true : item.taxId === tax.id,
    );
    if (baseItems.length === 0) {
      error(
        "tax_without_base",
        `«${tax.label}» no tiene artículos asociados. Indica a qué artículos aplica o confirma que aplica a toda la factura.`,
        tax.id,
      );
      continue;
    }
    // Un impuesto positivo requiere una base neta válida para repartirlo.
    const baseNet = sum(baseItems.map((i) => itemNetCents(i) ?? 0));
    if (tax.amountCents > 0 && baseNet <= 0) {
      error(
        "tax_without_base",
        `«${tax.label}» necesita una base gravable mayor que cero.`,
        tax.id,
      );
      continue;
    }
    if (tax.rateBp) {
      const expected = applyRate(baseNet, tax.rateBp);
      // Tolerancia: un centavo por línea (redondeo por línea en el comercio).
      if (Math.abs(expected - tax.amountCents) > Math.max(1, baseItems.length))
        warn(
          "tax_rate_mismatch",
          `«${tax.label}» impreso no coincide con ${tax.rateBp / 100} % de su base. Se usa el importe impreso.`,
          tax.id,
        );
    }
    if (tax.amountCents === 0) continue;
    if (pids.length === 0) continue; // base sin asignar: ya hay error de artículo
    const parts = allocate(
      tax.amountCents,
      pids.map((pid) => base!.get(pid)!),
    );
    pids.forEach((pid, i) => {
      const person = people.get(pid)!;
      person.taxes.push({ taxId: tax.id, cents: parts[i] });
      if (tax.included) person.includedTaxCents += parts[i];
      else person.taxCents += parts[i];
    });
  }

  // ---- 4. Propinas, cargos y ajustes ------------------------------------
  let tipCents = 0;
  let chargesCents = 0;
  let adjustmentsCents = 0;
  for (const charge of charges) {
    if (charge.kind === "tip") tipCents += applyCharge(charge, "tipCents");
    else if (charge.kind === "service_charge" || charge.kind === "other_charge")
      chargesCents += applyCharge(charge, "chargesCents");
    else if (charge.kind === "adjustment")
      adjustmentsCents += applyCharge(charge, "adjustmentsCents");
  }
  const suggestedTipCents = sum(
    input.charges
      .filter((c) => c.status === "suggested")
      .map((c) => c.amountCents ?? 0),
  );

  // ---- Totales y conciliación -----------------------------------------
  for (const person of people.values())
    person.totalCents =
      person.itemsCents +
      person.discountsCents +
      person.taxCents +
      person.tipCents +
      person.chargesCents +
      person.adjustmentsCents;

  const computedTotalCents =
    itemsCents +
    discountsCents +
    addedTaxCents +
    tipCents +
    chargesCents +
    adjustmentsCents;
  const printed = input.printedTotalCents;
  let differenceCents: Cents | null = null;
  if (printed === null)
    error(
      "missing_printed_total",
      "No se pudo leer el total de la factura. Escríbelo.",
    );
  else {
    differenceCents = printed - computedTotalCents;
    if (differenceCents !== 0)
      error(
        "total_mismatch",
        `La suma calculada difiere del total impreso en ${differenceCents} centavos. Corrige la factura o registra un ajuste.`,
      );
  }

  const canFinalize = !issues.some((i) => i.severity === "error");
  const list = [...people.values()];
  if (canFinalize) verifyInvariants(input, list, computedTotalCents);

  return {
    people: list,
    issues,
    canFinalize,
    totals: {
      itemsCents,
      assignedItemsCents,
      unassignedItemsCents: itemsCents - assignedItemsCents,
      discountsCents,
      addedTaxCents,
      includedTaxCents,
      tipCents,
      suggestedTipCents,
      chargesCents,
      adjustmentsCents,
      computedTotalCents,
      printedTotalCents: printed,
      differenceCents,
    },
  };

  /** Reparte un cargo pagado y devuelve el importe aplicado (0 si falla). */
  function applyCharge(
    charge: ReceiptCharge,
    field: "discountsCents" | "tipCents" | "chargesCents" | "adjustmentsCents",
  ): Cents {
    if (charge.amountCents === null) {
      error(
        "unreadable_charge",
        `No se pudo leer «${charge.label}». Escribe el importe.`,
        charge.id,
      );
      return 0;
    }
    assertCents(charge.amountCents, charge.label);
    const amount = charge.amountCents;
    if (
      (charge.kind === "discount" && amount > 0) ||
      (["tip", "service_charge", "other_charge"].includes(charge.kind) &&
        amount < 0)
    ) {
      error(
        "invalid_charge_sign",
        `«${charge.label}» tiene un signo incorrecto.`,
        charge.id,
      );
      return 0;
    }
    if (amount === 0) return 0;

    let targets: { participantId: string; weight: number }[];
    const rule = charge.split;
    if (rule.method === "custom") {
      const bad = rule.shares.find((s) => !order.has(s.participantId));
      if (bad) {
        error(
          "unknown_participant",
          `«${charge.label}»: persona desconocida.`,
          charge.id,
        );
        return 0;
      }
      const total = sum(rule.shares.map((s) => s.value));
      if (
        total !== amount ||
        rule.shares.some((s) => !Number.isSafeInteger(s.value))
      ) {
        error(
          "invalid_charge_split",
          `Los importes de «${charge.label}» no suman ${amount} centavos.`,
          charge.id,
        );
        return 0;
      }
      for (const s of rule.shares)
        people.get(s.participantId)![field] += s.value;
      return amount;
    }
    const pool = rule.participantIds ?? ids();
    if (pool.some((pid) => !order.has(pid))) {
      error(
        "unknown_participant",
        `«${charge.label}»: persona desconocida.`,
        charge.id,
      );
      return 0;
    }
    const sorted = [...new Set(pool)].sort(
      (a, b) => order.get(a)! - order.get(b)!,
    );
    if (rule.method === "equal")
      targets = sorted.map((participantId) => ({ participantId, weight: 1 }));
    else {
      const withTax = rule.basis === "items_plus_tax";
      targets = sorted
        .map((participantId) => {
          const p = people.get(participantId)!;
          return {
            participantId,
            weight: Math.max(
              0,
              itemShare(participantId) + (withTax ? p.taxCents : 0),
            ),
          };
        })
        .filter((t) => t.weight > 0);
    }
    if (targets.length === 0) {
      error(
        "invalid_charge_split",
        `Nadie con consumo asignado para repartir «${charge.label}».`,
        charge.id,
      );
      return 0;
    }
    const parts = allocate(
      amount,
      targets.map((t) => t.weight),
    );
    targets.forEach(
      (t, i) => (people.get(t.participantId)![field] += parts[i]),
    );
    return amount;
  }
}

type Weighted = { participantId: string; weight: number }[];

function allocationWeights(
  allocation: ItemAllocation,
  item: ReceiptItem,
  net: Cents,
  order: Map<string, number>,
): Weighted | { error: string; code: IssueCode } {
  const fail = (message: string, code: IssueCode = "invalid_allocation") => ({
    error: `«${item.name}»: ${message}`,
    code,
  });
  const raw: Weighted =
    allocation.mode === "equal"
      ? allocation.participantIds.map((participantId) => ({
          participantId,
          weight: 1,
        }))
      : allocation.shares.map((s) => ({
          participantId: s.participantId,
          weight: s.value,
        }));
  if (raw.length === 0)
    return fail("elige al menos una persona.", "unassigned_item");
  if (raw.some((w) => !order.has(w.participantId)))
    return fail("persona desconocida.", "unknown_participant");
  if (new Set(raw.map((w) => w.participantId)).size !== raw.length)
    return fail("una persona aparece dos veces.");
  if (raw.some((w) => !Number.isSafeInteger(w.weight) || w.weight < 0))
    return fail("las partes deben ser enteros positivos.");
  const total = sum(raw.map((w) => w.weight));
  if (allocation.mode === "units" && total !== item.quantity)
    return fail(`las unidades asignadas (${total}) no suman ${item.quantity}.`);
  if (allocation.mode === "percent" && total !== 10_000)
    return fail(`los porcentajes suman ${total / 100} %, no 100 %.`);
  if (allocation.mode === "amount") {
    if (net < 0)
      return fail("las devoluciones se reparten por partes o porcentaje.");
    if (total !== net)
      return fail(`los importes suman ${total} centavos y el artículo ${net}.`);
  }
  const weights = raw
    .filter((w) => w.weight > 0)
    .sort((a, b) => order.get(a.participantId)! - order.get(b.participantId)!);
  if (weights.length === 0) return fail("todas las partes son cero.");
  return weights;
}

/** Comprobación interna: si falla es un error de programación, no de datos. */
function verifyInvariants(
  input: ReceiptInput,
  people: PersonShare[],
  computedTotal: Cents,
) {
  const check = (ok: boolean, what: string) => {
    if (!ok) throw new Error(`Invariante de reparto violada: ${what}`);
  };
  const items = sum(input.items.map((i) => itemNetCents(i) ?? 0));
  check(sum(people.map((p) => p.itemsCents)) === items, "artículos");
  for (const tax of input.taxes)
    check(
      sum(
        people.flatMap((p) =>
          p.taxes.filter((t) => t.taxId === tax.id).map((t) => t.cents),
        ),
      ) === tax.amountCents,
      `impuesto ${tax.id}`,
    );
  const paidTips = sum(
    input.charges
      .filter((c) => c.kind === "tip" && c.status === "paid")
      .map((c) => c.amountCents ?? 0),
  );
  check(sum(people.map((p) => p.tipCents)) === paidTips, "propina");
  check(sum(people.map((p) => p.totalCents)) === computedTotal, "total");
  check(computedTotal === input.printedTotalCents, "total impreso");
}
