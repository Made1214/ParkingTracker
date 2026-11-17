import { describe, expect, it } from "vitest";
import {
  computeReceipt,
  type ItemAllocation,
  type ReceiptCharge,
  type ReceiptInput,
  type ReceiptItem,
  type ReceiptTax,
} from "./engine";

const names = [
  "ana",
  "carlos",
  "maria",
  "jose",
  "luis",
  "pedro",
  "sofia",
  "pago",
];
const people = (n: number) => names.slice(0, n).map((id) => ({ id, name: id }));

const item = (
  id: string,
  cents: number | null,
  extra: Partial<ReceiptItem> = {},
): ReceiptItem => ({
  id,
  name: id,
  quantity: 1,
  unitPriceCents: null,
  lineTotalCents: cents,
  ...extra,
});
const to = (itemId: string, ...participantIds: string[]): ItemAllocation => ({
  itemId,
  mode: "equal",
  participantIds,
});
const tax = (
  id: string,
  amountCents: number | null,
  extra: Partial<ReceiptTax> = {},
): ReceiptTax => ({
  id,
  label: id,
  amountCents,
  included: false,
  base: "items",
  ...extra,
});
const tip = (
  amountCents: number | null,
  extra: Partial<ReceiptCharge> = {},
): ReceiptCharge => ({
  id: "tip",
  label: "Propina",
  kind: "tip",
  amountCents,
  status: "paid",
  split: { method: "proportional" },
  ...extra,
});

function receipt(
  partial: Partial<ReceiptInput> & Pick<ReceiptInput, "items" | "allocations">,
): ReceiptInput {
  return {
    participants: people(8),
    taxes: [],
    charges: [],
    printedTotalCents: null,
    ...partial,
  };
}
const totals = (r: ReturnType<typeof computeReceipt>) =>
  Object.fromEntries(
    r.people
      .filter((p) => p.totalCents !== 0)
      .map((p) => [p.participantId, p.totalCents]),
  );
const codes = (r: ReturnType<typeof computeReceipt>) =>
  r.issues.map((i) => i.code);

describe("computeReceipt", () => {
  it("1. una persona, un artículo, sin impuestos", () => {
    const r = computeReceipt(
      receipt({
        participants: people(1),
        items: [item("cafe", 250)],
        allocations: [to("cafe", "ana")],
        printedTotalCents: 250,
      }),
    );
    expect(r.canFinalize).toBe(true);
    expect(totals(r)).toEqual({ ana: 250 });
  });

  it("2. ocho personas con consumos individuales", () => {
    const prices = [1200, 1800, 900, 1100, 1300, 700, 350, 1000];
    const r = computeReceipt(
      receipt({
        items: names.map((n, i) => item(`i${i}`, prices[i])),
        allocations: names.map((n, i) => to(`i${i}`, n)),
        printedTotalCents: 8350,
      }),
    );
    expect(r.canFinalize).toBe(true);
    expect(r.people.map((p) => p.totalCents)).toEqual(prices);
  });

  it("3-5. dividido entre 2, 3 y 8 sin perder centavos", () => {
    const r = computeReceipt(
      receipt({
        items: [item("a", 1001), item("b", 1000), item("c", 1000)],
        allocations: [
          to("a", "ana", "carlos"),
          to("b", "ana", "carlos", "maria"),
          to("c", ...names),
        ],
        printedTotalCents: 3001,
      }),
    );
    expect(r.canFinalize).toBe(true);
    const line = (pid: string, itemId: string) =>
      r.people
        .find((p) => p.participantId === pid)!
        .lines.find((l) => l.itemId === itemId)!;
    expect([line("ana", "a").cents, line("carlos", "a").cents]).toEqual([
      501, 500,
    ]);
    expect(["ana", "carlos", "maria"].map((p) => line(p, "b").cents)).toEqual([
      334, 333, 333,
    ]);
    expect(names.map((p) => line(p, "c").cents)).toEqual([
      125, 125, 125, 125, 125, 125, 125, 125,
    ]);
    expect(line("maria", "b")).toMatchObject({
      numerator: 1,
      denominator: 3,
      shared: true,
    });
  });

  it("6. división porcentual 50/30/20", () => {
    const r = computeReceipt(
      receipt({
        items: [item("botella", 4500)],
        allocations: [
          {
            itemId: "botella",
            mode: "percent",
            shares: [
              { participantId: "ana", value: 5000 },
              { participantId: "carlos", value: 3000 },
              { participantId: "maria", value: 2000 },
            ],
          },
        ],
        printedTotalCents: 4500,
      }),
    );
    expect(totals(r)).toEqual({ ana: 2250, carlos: 1350, maria: 900 });
    const pct = {
      itemId: "botella",
      mode: "percent" as const,
      shares: [{ participantId: "ana", value: 9000 }],
    };
    expect(
      codes(
        computeReceipt(
          receipt({
            items: [item("botella", 4500)],
            allocations: [pct],
            printedTotalCents: 4500,
          }),
        ),
      ),
    ).toContain("invalid_allocation");
  });

  it("7. productos repetidos conservan su identidad", () => {
    const r = computeReceipt(
      receipt({
        items: [
          item("cerveza-1", 300, { name: "Cerveza" }),
          item("cerveza-2", 300, { name: "Cerveza" }),
        ],
        allocations: [to("cerveza-1", "ana"), to("cerveza-2", "carlos")],
        printedTotalCents: 600,
      }),
    );
    expect(totals(r)).toEqual({ ana: 300, carlos: 300 });
  });

  it("8. una línea con cantidad 3 repartida por unidades", () => {
    const units = (shares: [string, number][]): ItemAllocation => ({
      itemId: "tacos",
      mode: "units",
      shares: shares.map(([participantId, value]) => ({
        participantId,
        value,
      })),
    });
    const tacos = item("tacos", 1500, { quantity: 3, unitPriceCents: 500 });
    const r = computeReceipt(
      receipt({
        items: [tacos],
        allocations: [
          units([
            ["ana", 1],
            ["luis", 1],
            ["pedro", 1],
          ]),
        ],
        printedTotalCents: 1500,
      }),
    );
    expect(totals(r)).toEqual({ ana: 500, luis: 500, pedro: 500 });
    const wrong = computeReceipt(
      receipt({
        items: [tacos],
        allocations: [units([["ana", 2]])],
        printedTotalCents: 1500,
      }),
    );
    expect(codes(wrong)).toContain("invalid_allocation");
    const mismatch = computeReceipt(
      receipt({
        items: [{ ...tacos, lineTotalCents: 1400 }],
        allocations: [to("tacos", "ana")],
        printedTotalCents: 1400,
      }),
    );
    expect(codes(mismatch)).toContain("line_mismatch");
  });

  it("9-10. descuento por producto y descuento global proporcional", () => {
    const r = computeReceipt(
      receipt({
        items: [item("a", 2000, { discountCents: 500 }), item("b", 500)],
        allocations: [to("a", "ana"), to("b", "carlos")],
        charges: [
          {
            id: "d",
            label: "Promo 10%",
            kind: "discount",
            amountCents: -200,
            status: "paid",
            split: { method: "proportional" },
          },
        ],
        printedTotalCents: 1800,
      }),
    );
    expect(r.canFinalize).toBe(true);
    // Neto: ana 1500, carlos 500 → descuento 150 / 50.
    expect(totals(r)).toEqual({ ana: 1350, carlos: 450 });
    const positive = computeReceipt(
      receipt({
        items: [item("a", 100)],
        allocations: [to("a", "ana")],
        charges: [
          {
            id: "d",
            label: "Promo",
            kind: "discount",
            amountCents: 50,
            status: "paid",
            split: { method: "equal" },
          },
        ],
        printedTotalCents: 150,
      }),
    );
    expect(codes(positive)).toContain("invalid_charge_sign");
  });

  it("11. ITBMS 7 % agregado y repartido según consumo gravado", () => {
    const r = computeReceipt(
      receipt({
        items: [
          item("a", 1000, { taxId: "itbms7" }),
          item("b", 2000, { taxId: "itbms7" }),
        ],
        allocations: [to("a", "ana"), to("b", "carlos")],
        taxes: [tax("itbms7", 210, { rateBp: 700 })],
        printedTotalCents: 3210,
      }),
    );
    expect(r.canFinalize).toBe(true);
    expect(totals(r)).toEqual({ ana: 1070, carlos: 2140 });
  });

  it("12-13. 7 % y 10 % en la misma factura: cada impuesto solo sobre su base", () => {
    const r = computeReceipt(
      receipt({
        items: [
          item("comida", 2000, { taxId: "t7" }),
          item("vino", 3000, { taxId: "t10" }),
        ],
        allocations: [to("comida", "ana", "carlos"), to("vino", "carlos")],
        taxes: [
          tax("t7", 140, { rateBp: 700 }),
          tax("t10", 300, { rateBp: 1000 }),
        ],
        printedTotalCents: 5440,
      }),
    );
    expect(r.canFinalize).toBe(true);
    // Ana solo comió: no le toca nada del 10 %.
    const ana = r.people.find((p) => p.participantId === "ana")!;
    expect(ana.taxes).toEqual([{ taxId: "t7", cents: 70 }]);
    expect(totals(r)).toEqual({ ana: 1070, carlos: 4370 });
  });

  it("13b. tasa impresa distinta a la esperada: avisa y usa la impresa", () => {
    const r = computeReceipt(
      receipt({
        items: [item("vino", 3000, { taxId: "t" })],
        allocations: [to("vino", "ana")],
        taxes: [tax("t", 210, { rateBp: 1000 })],
        printedTotalCents: 3210,
      }),
    );
    expect(r.canFinalize).toBe(true);
    expect(codes(r)).toEqual(["tax_rate_mismatch"]);
    expect(totals(r)).toEqual({ ana: 3210 });
  });

  it("13c. impuesto solo a nivel de factura exige confirmar su base", () => {
    const base = receipt({
      items: [item("a", 1000), item("b", 1000)],
      allocations: [to("a", "ana"), to("b", "carlos")],
      taxes: [tax("t", 140)],
      printedTotalCents: 2140,
    });
    expect(codes(computeReceipt(base))).toContain("tax_without_base");
    const confirmed = computeReceipt({
      ...base,
      taxes: [tax("t", 140, { base: "all_items" })],
    });
    expect(confirmed.canFinalize).toBe(true);
    expect(totals(confirmed)).toEqual({ ana: 1070, carlos: 1070 });
  });

  it("13d. impuesto incluido en precios no se suma al total", () => {
    const r = computeReceipt(
      receipt({
        items: [item("a", 1070, { taxId: "t" })],
        allocations: [to("a", "ana")],
        taxes: [tax("t", 70, { included: true })],
        printedTotalCents: 1070,
      }),
    );
    expect(r.canFinalize).toBe(true);
    expect(r.people[0]).toMatchObject({
      totalCents: 1070,
      includedTaxCents: 70,
      taxCents: 0,
    });
  });

  it("14. factura exenta: no se inventan impuestos", () => {
    const r = computeReceipt(
      receipt({
        items: [item("a", 800)],
        allocations: [to("a", "ana")],
        printedTotalCents: 800,
      }),
    );
    expect(r.totals.addedTaxCents).toBe(0);
    expect(r.people[0].taxCents).toBe(0);
  });

  it("15-16. propina sugerida no suma; propina pagada sí, proporcional por defecto", () => {
    const base = {
      items: [item("a", 3000), item("b", 1000)],
      allocations: [to("a", "ana"), to("b", "carlos")],
    };
    const suggested = computeReceipt(
      receipt({
        ...base,
        charges: [tip(400, { status: "suggested" })],
        printedTotalCents: 4000,
      }),
    );
    expect(suggested.canFinalize).toBe(true);
    expect(suggested.totals).toMatchObject({
      tipCents: 0,
      suggestedTipCents: 400,
    });
    const paid = computeReceipt(
      receipt({ ...base, charges: [tip(400)], printedTotalCents: 4400 }),
    );
    expect(totals(paid)).toEqual({ ana: 3300, carlos: 1100 });
    const equal = computeReceipt(
      receipt({
        ...base,
        charges: [
          tip(401, {
            split: { method: "equal", participantIds: ["carlos", "ana"] },
          }),
        ],
        printedTotalCents: 4401,
      }),
    );
    expect(totals(equal)).toEqual({ ana: 3201, carlos: 1200 });
    const custom = computeReceipt(
      receipt({
        ...base,
        charges: [
          tip(400, {
            split: {
              method: "custom",
              shares: [
                { participantId: "ana", value: 100 },
                { participantId: "carlos", value: 200 },
              ],
            },
          }),
        ],
        printedTotalCents: 4400,
      }),
    );
    expect(codes(custom)).toContain("invalid_charge_split");
  });

  it("17. OCR con campos faltantes bloquea el cierre en vez de inventar", () => {
    const r = computeReceipt(
      receipt({
        items: [item("a", null), item("b", 500)],
        allocations: [to("a", "ana"), to("b", "ana")],
        taxes: [tax("t", null)],
        charges: [tip(null)],
        printedTotalCents: null,
      }),
    );
    expect(r.canFinalize).toBe(false);
    expect(codes(r)).toEqual(
      expect.arrayContaining([
        "unreadable_price",
        "unreadable_tax",
        "unreadable_charge",
        "missing_printed_total",
      ]),
    );
  });

  it("18. fracciones de centavo: reparto determinista y exacto", () => {
    const input = receipt({
      items: [
        item("a", 1, { taxId: "t" }),
        item("b", 1, { taxId: "t" }),
        item("c", 1, { taxId: "t" }),
      ],
      allocations: [to("a", "ana"), to("b", "carlos"), to("c", "maria")],
      taxes: [tax("t", 1, { base: "items" })],
      charges: [tip(2)],
      printedTotalCents: 6,
    });
    const first = computeReceipt(input);
    expect(first.canFinalize).toBe(true);
    expect(totals(first)).toEqual({ ana: 3, carlos: 2, maria: 1 });
    expect(computeReceipt(input)).toEqual(first);
  });

  it("25. productos sin asignar bloquean el cierre", () => {
    const r = computeReceipt(
      receipt({
        items: [item("a", 500), item("b", 500)],
        allocations: [to("a", "ana")],
        printedTotalCents: 1000,
      }),
    );
    expect(r.canFinalize).toBe(false);
    expect(r.totals.unassignedItemsCents).toBe(500);
    expect(codes(r)).toContain("unassigned_item");
  });

  it("27. total calculado distinto del impreso: muestra la diferencia; un ajuste explícito lo resuelve", () => {
    const base = {
      items: [item("a", 1000)],
      allocations: [to("a", "ana", "carlos")],
      printedTotalCents: 1003,
    };
    const r = computeReceipt(receipt(base));
    expect(r.canFinalize).toBe(false);
    expect(r.totals.differenceCents).toBe(3);
    const adjusted = computeReceipt(
      receipt({
        ...base,
        charges: [
          {
            id: "adj",
            label: "Ajuste",
            kind: "adjustment",
            amountCents: 3,
            status: "paid",
            split: { method: "equal", participantIds: ["ana", "carlos"] },
          },
        ],
      }),
    );
    expect(codes(adjusted)).toEqual([]);
    expect(totals(adjusted)).toEqual({ ana: 502, carlos: 501 });
  });

  it("28. devolución (línea negativa) reduce el total de quien la tenía", () => {
    const r = computeReceipt(
      receipt({
        items: [item("plato", 1500), item("devolucion", -500)],
        allocations: [to("plato", "ana", "carlos"), to("devolucion", "carlos")],
        printedTotalCents: 1000,
      }),
    );
    expect(r.canFinalize).toBe(true);
    expect(totals(r)).toEqual({ ana: 750, carlos: 250 });
  });

  it("valida personas desconocidas, repetidas y asignaciones dobles", () => {
    const r = computeReceipt(
      receipt({
        items: [item("a", 100), item("b", 100), item("c", 100)],
        allocations: [
          to("a", "nadie"),
          to("b", "ana", "ana"),
          to("c", "ana"),
          to("c", "carlos"),
        ],
        printedTotalCents: 300,
      }),
    );
    expect(codes(r)).toEqual(
      expect.arrayContaining(["unknown_participant", "invalid_allocation"]),
    );
  });

  it("escenario completo: ocho amigos en un restaurante con alcohol", () => {
    const r = computeReceipt(
      receipt({
        items: [
          item("hamburguesa", 1200, { taxId: "t7" }),
          item("pizza", 1800, { taxId: "t7" }),
          item("pasta", 1600, { taxId: "t7" }),
          item("entrada", 1000, { taxId: "t7" }),
          item("botella", 4500, { taxId: "t10" }),
          item("bebida", 350, { taxId: "t7" }),
        ],
        allocations: [
          to("hamburguesa", "ana"),
          to("pizza", "carlos"),
          to("pasta", "maria", "jose"),
          to("entrada", "ana", "luis", "pedro"),
          to("botella", "ana", "carlos", "luis", "pedro"),
          to("bebida", "sofia"),
        ],
        taxes: [
          tax("t7", 417, { rateBp: 700 }),
          tax("t10", 450, { rateBp: 1000 }),
        ],
        charges: [tip(1045)],
        printedTotalCents: 12362,
      }),
    );
    expect(r.issues).toEqual([]);
    expect(r.people.reduce((a, p) => a + p.totalCents, 0)).toBe(12362);
    const sofia = r.people.find((p) => p.participantId === "sofia")!;
    expect(sofia.taxes.map((t) => t.taxId)).toEqual(["t7"]);
    expect(r.people.find((p) => p.participantId === "pago")!.totalCents).toBe(
      0,
    );
  });

  it("reparto por importes, cargo de servicio y propina personalizada", () => {
    const r = computeReceipt(
      receipt({
        items: [item("botella", 4500)],
        allocations: [
          {
            itemId: "botella",
            mode: "amount",
            shares: [
              { participantId: "ana", value: 2500 },
              { participantId: "carlos", value: 2000 },
            ],
          },
        ],
        charges: [
          tip(300, {
            split: {
              method: "custom",
              shares: [
                { participantId: "ana", value: 100 },
                { participantId: "carlos", value: 200 },
              ],
            },
          }),
          {
            id: "svc",
            label: "Cargo de servicio",
            kind: "service_charge",
            amountCents: 450,
            status: "paid",
            split: { method: "proportional", basis: "items_plus_tax" },
          },
          {
            id: "z",
            label: "Cero",
            kind: "other_charge",
            amountCents: 0,
            status: "paid",
            split: { method: "equal" },
          },
        ],
        taxes: [tax("t0", 0, { base: "all_items" })],
        printedTotalCents: 5250,
      }),
    );
    expect(r.issues).toEqual([]);
    expect(totals(r)).toEqual({ ana: 2850, carlos: 2400 });
    expect(r.totals.chargesCents).toBe(450);
  });

  it("rechaza asignaciones y cargos mal formados", () => {
    const one = (allocation: ItemAllocation, lineTotalCents = 1000) =>
      codes(
        computeReceipt(
          receipt({
            items: [item("x", lineTotalCents)],
            allocations: [allocation],
            printedTotalCents: lineTotalCents,
          }),
        ),
      );
    expect(one({ itemId: "x", mode: "equal", participantIds: [] })).toContain(
      "unassigned_item",
    );
    expect(
      one({
        itemId: "x",
        mode: "units",
        shares: [{ participantId: "ana", value: 0.5 }],
      }),
    ).toContain("invalid_allocation");
    expect(
      one({
        itemId: "x",
        mode: "amount",
        shares: [{ participantId: "ana", value: 900 }],
      }),
    ).toContain("invalid_allocation");
    expect(
      one(
        {
          itemId: "x",
          mode: "amount",
          shares: [{ participantId: "ana", value: -1000 }],
        },
        -1000,
      ),
    ).toContain("invalid_allocation");
    expect(
      one({
        itemId: "x",
        mode: "percent",
        shares: [{ participantId: "ana", value: 0 }],
      }),
    ).toContain("invalid_allocation");
    expect(
      one({ itemId: "x", mode: "equal", participantIds: ["ana"] }),
    ).toEqual([]);

    const charged = (charge: ReceiptCharge) =>
      codes(
        computeReceipt(
          receipt({
            items: [item("x", 1000)],
            allocations: [to("x", "ana")],
            charges: [charge],
            printedTotalCents: 1100,
          }),
        ),
      );
    expect(
      charged(
        tip(100, {
          split: {
            method: "custom",
            shares: [{ participantId: "nadie", value: 100 }],
          },
        }),
      ),
    ).toContain("unknown_participant");
    expect(
      charged(
        tip(100, { split: { method: "equal", participantIds: ["nadie"] } }),
      ),
    ).toContain("unknown_participant");
    expect(
      charged(
        tip(100, {
          split: { method: "proportional", participantIds: ["carlos"] },
        }),
      ),
    ).toContain("invalid_charge_split");
    expect(charged(tip(-100))).toContain("invalid_charge_sign");
    expect(
      codes(
        computeReceipt(
          receipt({
            participants: [],
            items: [],
            allocations: [],
            printedTotalCents: 0,
          }),
        ),
      ),
    ).toEqual(["no_participants"]);
    expect(
      codes(
        computeReceipt(
          receipt({
            items: [item("q", 100, { quantity: 0 })],
            allocations: [to("q", "ana")],
            printedTotalCents: 100,
          }),
        ),
      ),
    ).toContain("invalid_quantity");
  });
});
