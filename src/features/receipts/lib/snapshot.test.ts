import { describe, expect, it } from "vitest";
import { computeReceipt } from "./engine";
import { emptyDocument, toEngineInput, type ReceiptDocument } from "./document";
import { buildSnapshot, readResult } from "./snapshot";

const u = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

function doc(partial: Partial<ReceiptDocument> = {}): ReceiptDocument {
  return {
    ...emptyDocument(),
    merchant: "La Fonda",
    date: "2026-11-16",
    printedTotalCents: 3000,
    participants: [
      { id: "ana", name: "Ana", kind: "member", userId: u(1) },
      { id: "pedro", name: "Pedro", kind: "guest", guestId: u(9) },
    ],
    items: [
      {
        id: "pizza",
        name: "Pizza",
        quantity: 1,
        unitPriceCents: null,
        lineTotalCents: 1800,
      },
      {
        id: "pasta",
        name: "Pasta",
        quantity: 1,
        unitPriceCents: null,
        lineTotalCents: 1200,
      },
    ],
    allocations: [
      { itemId: "pizza", mode: "equal", participantIds: ["ana", "pedro"] },
      { itemId: "pasta", mode: "equal", participantIds: ["pedro"] },
    ],
    payments: [{ participantId: "ana", cents: 3000, method: "cash" }],
    ...partial,
  };
}

describe("buildSnapshot", () => {
  it("congela el reparto, lo pagado y el saldo de cada persona", () => {
    const d = doc();
    const snap = buildSnapshot(
      d,
      computeReceipt(toEngineInput(d)),
      new Date("2026-11-16T12:00:00Z"),
    );
    if ("error" in snap) throw new Error(snap.error);
    expect(snap).toMatchObject({
      computedAt: "2026-11-16T12:00:00.000Z",
      totalCents: 3000,
      fingerprint: "la fonda|2026-11-16|3000|",
    });
    expect(
      snap.people.map((p) => [p.name, p.totalCents, p.paidCents, p.netCents]),
    ).toEqual([
      ["Ana", 900, 3000, 2100],
      ["Pedro", 2100, 0, -2100],
    ]);
    expect(snap.people[1].lines[0]).toMatchObject({
      itemId: "pizza",
      numerator: 1,
      denominator: 2,
      shared: true,
    });
    expect(readResult(snap)).toEqual(snap);
  });

  it("sin comercio o fecha no hay huella de duplicado", () => {
    const d = doc({ merchant: null });
    const snap = buildSnapshot(d, computeReceipt(toEngineInput(d)));
    expect("error" in snap ? null : snap.fingerprint).toBeNull();
  });

  it("no congela facturas sin resolver ni pagos que no cuadran", () => {
    const unassigned = doc({ allocations: [] });
    expect(
      buildSnapshot(unassigned, computeReceipt(toEngineInput(unassigned))),
    ).toEqual({
      error: "La factura aún tiene datos por resolver.",
    });
    const short = doc({
      payments: [{ participantId: "ana", cents: 100, method: "card" }],
    });
    expect(
      buildSnapshot(short, computeReceipt(toEngineInput(short))),
    ).toMatchObject({
      error: expect.stringMatching(/pagos suman/i),
    });
    expect(readResult({ schemaVersion: 2 })).toBeNull();
  });
});
