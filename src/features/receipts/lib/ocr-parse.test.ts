import { describe, expect, it } from "vitest";
import { computeReceipt } from "./engine";
import { guessCategory, parseReceiptLines, type OcrLine } from "./ocr-parse";

const lines = (text: string, confidence = 0.95): OcrLine[] =>
  text
    .trim()
    .split("\n")
    .map((t, i) => ({
      text: t,
      confidence,
      bbox: { x: 0.05, y: i / 40, w: 0.9, h: 0.02 },
    }));

const restaurant = `
RESTAURANTE LA FONDA
RUC 155-555-55 DV 12
Factura No. 0001234
Fecha: 16/11/2026 20:15
CANT DESCRIPCION          TOTAL
2 HAMBURGUESA  12.00      24.00
1 PIZZA MARGARITA         18.00
PASTA ALFREDO             16,00
DESC. PROMO               -2.00
1 BOTELLA VINO            45.00
SUBTOTAL                 101.00
ITBMS 7%                   3.92
ITBMS 10%                  4.50
PROPINA SUGERIDA 10%      10.10
TOTAL                    109.42
VISA ****1234            109.42
`;

describe("parseReceiptLines", () => {
  const parsed = parseReceiptLines(lines(restaurant));

  it("lee encabezado, fecha y número de factura", () => {
    expect(parsed).toMatchObject({
      merchant: "RESTAURANTE LA FONDA",
      date: "2026-11-16",
      invoiceNumber: "0001234",
      printedTotalCents: 10942,
      subtotalCents: 10100,
    });
  });

  it("separa artículos de subtotales, impuestos, propina y pago", () => {
    expect(
      parsed.items.map((i) => [
        i.name,
        i.quantity,
        i.unitPriceCents,
        i.lineTotalCents,
        i.discountCents,
      ]),
    ).toEqual([
      ["HAMBURGUESA", 2, 1200, 2400, undefined],
      ["PIZZA MARGARITA", 1, null, 1800, undefined],
      ["PASTA ALFREDO", 1, null, 1600, 200],
      ["BOTELLA VINO", 1, null, 4500, undefined],
    ]);
    expect(parsed.items[0].bbox).toEqual({
      x: 0.05,
      y: 5 / 40,
      w: 0.9,
      h: 0.02,
    });
  });

  it("detecta varias líneas de impuesto y propone la base por categoría", () => {
    expect(parsed.taxes.map((t) => [t.rateBp, t.amountCents])).toEqual([
      [700, 392],
      [1000, 450],
    ]);
    const [t7, t10] = parsed.taxes;
    expect(parsed.items.map((i) => i.taxId)).toEqual([
      t7.id,
      t7.id,
      t7.id,
      t10.id,
    ]);
    expect(parsed.warnings).toContain(
      "La factura tiene varias líneas de impuesto: confirma a qué artículos aplica cada una.",
    );
  });

  it("15. la propina sugerida queda como sugerida y no suma", () => {
    expect(parsed.charges).toMatchObject([
      { kind: "tip", status: "suggested", amountCents: 1010 },
    ]);
    const people = [{ id: "a", name: "A" }];
    const r = computeReceipt({
      participants: people,
      items: parsed.items,
      allocations: parsed.items.map((i) => ({
        itemId: i.id,
        mode: "equal" as const,
        participantIds: ["a"],
      })),
      taxes: parsed.taxes,
      charges: parsed.charges,
      printedTotalCents: parsed.printedTotalCents,
    });
    expect(r.totals.differenceCents).toBe(0);
    expect(r.canFinalize).toBe(true);
  });

  it("propina pagada, cargo de servicio, descuento global y devolución", () => {
    const p = parseReceiptLines(
      lines(`
CAFE UNIDO
2X CAPPUCCINO 3.50 7.00
DEVOLUCION CAPPUCCINO -3.50
SUBTOTAL 3.50
DESCUENTO CLIENTE -0.50
CARGO POR SERVICIO 0.30
PROPINA 0.70
TOTAL B/. 4.00
`),
    );
    expect(p.items.map((i) => [i.name, i.quantity, i.lineTotalCents])).toEqual([
      ["CAPPUCCINO", 2, 700],
      ["DEVOLUCION CAPPUCCINO", 1, -350],
    ]);
    expect(p.charges.map((c) => [c.kind, c.status, c.amountCents])).toEqual([
      ["discount", "paid", -50],
      ["service_charge", "paid", 30],
      ["tip", "paid", 70],
    ]);
    expect(p.printedTotalCents).toBe(400);
    expect(p.warnings).toEqual([]);
  });

  it("17. no inventa precios ilegibles y marca la baja confianza", () => {
    const p = parseReceiptLines(
      lines(
        `
FONDA
ARROZ CON POLLO 5.00
PATACONES 1?.O0
TOTAL 1,234
`,
        0.6,
      ),
    );
    expect(p.items[1]).toMatchObject({
      name: "PATACONES",
      lineTotalCents: null,
      confidence: 0,
    });
    expect(p.printedTotalCents).toBe(123400);
    expect(p.printedTotalConfidence).toBe(0.3); // ambiguo → la mitad
    expect(p.warnings).toEqual(
      expect.arrayContaining(["Hay precios que no se pudieron leer."]),
    );
  });

  it("factura exenta, una sola tasa y totales que faltan", () => {
    const one = parseReceiptLines(
      lines("SUPER 99\nLECHE 2.50\nPAN 1.50\nITBMS 0.00\nTOTAL 4.00"),
    );
    expect(one.items.every((i) => i.taxId === undefined)).toBe(true);
    const single = parseReceiptLines(
      lines("BAR\nNACHOS 8.00\nITBMS 7% 0.56\nTOTAL 8.56"),
    );
    expect(single.items[0].taxId).toBe(single.taxes[0].id);
    const empty = parseReceiptLines(lines("HOLA"));
    expect(empty.warnings).toEqual([
      "No se encontró el total de la factura.",
      "No se reconocieron artículos.",
    ]);
    const mismatch = parseReceiptLines(
      lines("BAR\nNACHOS 8.00\nSUBTOTAL 9.00\nTOTAL 9.00"),
    );
    expect(mismatch.warnings).toContain(
      "La suma de los artículos no coincide con el subtotal impreso.",
    );
  });

  it("deduce la tasa aunque el OCR pierda el signo %, sin confundirla con el importe", () => {
    const p = parseReceiptLines(
      lines(
        "BAR\nNACHOS 10.00\nCERVEZA 3.00\nITBMS 7      0.70\nITBMS 10     0.30\nITBMS 4.17\nTOTAL 14.17",
      ),
    );
    expect(p.taxes.map((t) => t.rateBp)).toEqual([700, 1000, null]);
    expect(p.items.map((i) => i.taxId)).toEqual([p.taxes[0].id, p.taxes[1].id]);
  });

  it("fechas en varios formatos y fechas imposibles", () => {
    expect(parseReceiptLines(lines("X\n2026-01-31")).date).toBe("2026-01-31");
    expect(parseReceiptLines(lines("X\n05-03-26")).date).toBe("2026-03-05");
    expect(parseReceiptLines(lines("X\n31/02/2026")).date).toBeNull();
  });

  it("clasifica bebidas", () => {
    expect(guessCategory("Cerveza Balboa")).toBe("alcoholic_beverage");
    expect(guessCategory("Limonada")).toBe("non_alcoholic_beverage");
    expect(guessCategory("Pizza Margarita")).toBe("food");
  });
});
