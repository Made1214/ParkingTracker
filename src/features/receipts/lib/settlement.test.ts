import { describe, expect, it } from "vitest";
import { computeSettlement, personalFinanceView } from "./settlement";

const order = ["ana", "carlos", "maria", "jose"];
const ok = (r: ReturnType<typeof computeSettlement>) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};
const balance = (r: ReturnType<typeof ok>, id: string) =>
  r.balances.find((b) => b.participantId === id)!;

describe("computeSettlement", () => {
  const consumed = { ana: 2000, carlos: 5000, maria: 3000, jose: 2000 };

  it("19. una persona paga toda la factura", () => {
    const r = ok(
      computeSettlement(order, consumed, [
        { participantId: "ana", cents: 12000 },
      ]),
    );
    expect(balance(r, "ana")).toMatchObject({
      netCents: 10000,
      status: "is_owed",
    });
    expect(r.transfers).toEqual([
      { fromId: "carlos", toId: "ana", cents: 5000 },
      { fromId: "maria", toId: "ana", cents: 3000 },
      { fromId: "jose", toId: "ana", cents: 2000 },
    ]);
    // Integración financiera: salida 120, gasto propio 20, por cobrar 100.
    expect(personalFinanceView(balance(r, "ana"))).toEqual({
      cashOutCents: 12000,
      cashInCents: 0,
      attributableExpenseCents: 2000,
      receivableCents: 10000,
      payableCents: 0,
    });
  });

  it("20. dos personas pagan parcialmente: balances netos sin reembolsos circulares", () => {
    const r = ok(
      computeSettlement(
        order,
        { ana: 4000, carlos: 4000, maria: 3000, jose: 2000 },
        [
          { participantId: "ana", cents: 10000 },
          { participantId: "carlos", cents: 3000 },
        ],
      ),
    );
    expect(r.balances.map((b) => b.netCents)).toEqual([
      6000, -1000, -3000, -2000,
    ]);
    expect(r.transfers.every((t) => t.toId === "ana")).toBe(true);
    expect(r.transfers.reduce((a, t) => a + t.cents, 0)).toBe(6000);
  });

  it("21-22. reembolso parcial y total; el reembolso no es ingreso", () => {
    const pays = [{ participantId: "ana", cents: 12000 }];
    const partial = ok(
      computeSettlement(order, consumed, pays, [
        { fromId: "carlos", toId: "ana", cents: 3000 },
      ]),
    );
    expect(balance(partial, "carlos")).toMatchObject({
      netCents: -2000,
      status: "owes",
    });
    const view = personalFinanceView(balance(partial, "ana"));
    expect(view).toMatchObject({
      cashInCents: 3000,
      attributableExpenseCents: 2000,
      receivableCents: 7000,
    });

    const full = ok(
      computeSettlement(order, consumed, pays, [
        { fromId: "carlos", toId: "ana", cents: 5000 },
        { fromId: "maria", toId: "ana", cents: 3000 },
        { fromId: "jose", toId: "ana", cents: 2000 },
      ]),
    );
    expect(full.balances.every((b) => b.status === "settled")).toBe(true);
    expect(full.transfers).toEqual([]);
  });

  it("avisa de un reembolso mayor a la deuda", () => {
    const r = ok(
      computeSettlement(
        order,
        consumed,
        [{ participantId: "ana", cents: 12000 }],
        [{ fromId: "jose", toId: "ana", cents: 2500 }],
      ),
    );
    expect(r.warnings).toHaveLength(1);
  });

  it("rechaza pagos que no cuadran o personas ajenas", () => {
    expect(computeSettlement(order, consumed, []).ok).toBe(false);
    expect(
      computeSettlement(order, consumed, [{ participantId: "ana", cents: 100 }])
        .ok,
    ).toBe(false);
    expect(
      computeSettlement(order, consumed, [{ participantId: "x", cents: 12000 }])
        .ok,
    ).toBe(false);
    expect(
      computeSettlement(order, consumed, [{ participantId: "ana", cents: 0 }])
        .ok,
    ).toBe(false);
    expect(
      computeSettlement(
        order,
        consumed,
        [{ participantId: "ana", cents: 12000 }],
        [{ fromId: "ana", toId: "ana", cents: 1 }],
      ).ok,
    ).toBe(false);
    expect(
      computeSettlement(
        order,
        consumed,
        [{ participantId: "ana", cents: 12000 }],
        [{ fromId: "jose", toId: "ana", cents: -1 }],
      ).ok,
    ).toBe(false);
  });
});
