import { describe, expect, it } from "vitest";
import { buildReceiptExpenses, type LedgerParticipant } from "./ledger";
import {
  emptyDocument,
  readDocument,
  receiptDocumentSchema,
  toEngineInput,
  toLedgerParticipants,
} from "./document";

const u = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const people: LedgerParticipant[] = [
  { id: "luis", kind: "member", userId: u(2) },
  { id: "sofia", kind: "member", userId: u(3) },
  { id: "dario", kind: "member", userId: u(4) },
  { id: "pedro", kind: "guest", guestId: u(9) },
];
const consumed = new Map([
  ["luis", 2000],
  ["sofia", 2500],
  ["dario", 3000],
  ["pedro", 1500],
]);
const ok = (r: ReturnType<typeof buildReceiptExpenses>) => {
  if (!r.ok) throw new Error(r.error);
  return r.expenses;
};

describe("buildReceiptExpenses", () => {
  it("19. un pagador: un gasto con todas las partes", () => {
    const [expense, ...rest] = ok(
      buildReceiptExpenses(people, consumed, [
        { participantId: "luis", cents: 9000 },
      ]),
    );
    expect(rest).toEqual([]);
    expect(expense).toEqual({
      paid_by: u(2),
      amount_cents: 9000,
      splits: [
        { user_id: u(2), amount_cents: 2000 },
        { user_id: u(3), amount_cents: 2500 },
        { user_id: u(4), amount_cents: 3000 },
      ],
      guest_shares: [{ guest_id: u(9), amount_cents: 1500 }],
    });
  });

  it("20. dos pagadores: cada uno cubre primero lo suyo y todo cuadra", () => {
    const expenses = ok(
      buildReceiptExpenses(people, consumed, [
        { participantId: "luis", cents: 6000 },
        { participantId: "sofia", cents: 3000 },
      ]),
    );
    for (const e of expenses) {
      const parts = [...e.splits, ...e.guest_shares].reduce(
        (a, s) => a + s.amount_cents,
        0,
      );
      expect(parts).toBe(e.amount_cents);
    }
    const perPerson = new Map<string, number>();
    for (const e of expenses)
      for (const s of [
        ...e.splits.map((x) => [x.user_id, x.amount_cents] as const),
        ...e.guest_shares.map((x) => [x.guest_id, x.amount_cents] as const),
      ])
        perPerson.set(s[0], (perPerson.get(s[0]) ?? 0) + s[1]);
    expect(Object.fromEntries(perPerson)).toEqual({
      [u(2)]: 2000,
      [u(3)]: 2500,
      [u(4)]: 3000,
      [u(9)]: 1500,
    });
    // Sofía cubre su propio consumo con su pago.
    expect(expenses[1].splits[0]).toEqual({
      user_id: u(3),
      amount_cents: 2500,
    });
  });

  it("agrupa pagos repetidos de la misma persona y omite partes en cero", () => {
    const expenses = ok(
      buildReceiptExpenses(people, new Map([["dario", 1000]]), [
        { participantId: "luis", cents: 400 },
        { participantId: "luis", cents: 600 },
      ]),
    );
    expect(expenses).toEqual([
      {
        paid_by: u(2),
        amount_cents: 1000,
        splits: [{ user_id: u(4), amount_cents: 1000 }],
        guest_shares: [],
      },
    ]);
  });

  it("rechaza pagos inválidos", () => {
    const err = (
      payments: { participantId: string; cents: number }[],
      c = consumed,
    ) => {
      const r = buildReceiptExpenses(people, c, payments);
      return r.ok ? null : r.error;
    };
    expect(err([])).toMatch(/quién pagó/);
    expect(err([{ participantId: "pedro", cents: 9000 }])).toMatch(/miembros/);
    expect(err([{ participantId: "nadie", cents: 9000 }])).toMatch(
      /desconocido/,
    );
    expect(err([{ participantId: "luis", cents: 0 }])).toMatch(
      /mayor que cero/,
    );
    expect(err([{ participantId: "luis", cents: 8000 }])).toMatch(/suman/);
    expect(
      err(
        [{ participantId: "luis", cents: 100 }],
        new Map([
          ["luis", -100],
          ["sofia", 200],
        ]),
      ),
    ).toMatch(/negativo/);
  });
});

describe("receiptDocumentSchema", () => {
  it("acepta un documento vacío y uno completo", () => {
    expect(receiptDocumentSchema.parse(emptyDocument())).toEqual(
      emptyDocument(),
    );
    const doc = {
      ...emptyDocument(),
      merchant: "La Fonda",
      date: "2026-11-16",
      printedTotalCents: 1070,
      participants: [
        { id: "a", name: "Ana", kind: "member", userId: u(1) },
        { id: "p", name: "Pedro", kind: "guest", guestId: u(9) },
      ],
      items: [
        {
          id: "i1",
          name: "Pizza",
          quantity: 1,
          unitPriceCents: 1000,
          lineTotalCents: 1000,
          taxId: "t7",
          bbox: { x: 0.1, y: 0.2, w: 0.5, h: 0.03 },
        },
      ],
      allocations: [
        { itemId: "i1", mode: "equal", participantIds: ["a", "p"] },
      ],
      taxes: [
        {
          id: "t7",
          label: "ITBMS 7%",
          amountCents: 70,
          included: false,
          base: "items",
        },
      ],
      payments: [{ participantId: "a", cents: 1070, method: "yappy" }],
    };
    const parsed = receiptDocumentSchema.parse(doc);
    expect(toEngineInput(parsed).participants).toEqual([
      { id: "a", name: "Ana" },
      { id: "p", name: "Pedro" },
    ]);
    expect(toLedgerParticipants(parsed)).toEqual([
      { id: "a", kind: "member", userId: u(1) },
      { id: "p", kind: "guest", guestId: u(9) },
    ]);
  });

  it("rechaza ids repetidos, importes con decimales y regiones fuera de la imagen", () => {
    const base = emptyDocument();
    const twice = { id: "a", name: "Ana", kind: "member", userId: u(1) };
    expect(
      receiptDocumentSchema.safeParse({
        ...base,
        participants: [twice, { ...twice, id: "b" }],
      }).success,
    ).toBe(false);
    expect(
      receiptDocumentSchema.safeParse({ ...base, printedTotalCents: 10.5 })
        .success,
    ).toBe(false);
    expect(
      receiptDocumentSchema.safeParse({
        ...base,
        items: [
          {
            id: "i",
            name: "x",
            quantity: 1,
            unitPriceCents: null,
            lineTotalCents: 1,
            bbox: { x: 2, y: 0, w: 0, h: 0 },
          },
        ],
      }).success,
    ).toBe(false);
    expect(readDocument({ nope: true })).toEqual(emptyDocument());
  });
});
