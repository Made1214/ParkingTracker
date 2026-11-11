import { describe, expect, it } from "vitest";
import {
  amountToCents,
  equalShares,
  expenseError,
  formatMoney,
  parseExpenseForm,
  toCents,
} from "./expense-form";

const GROUP = "10000000-0000-4000-8000-000000000001";
const EVENT = "20000000-0000-4000-8000-000000000001";
const ANA = "00000000-0000-4000-8000-000000000001";
const LUIS = "00000000-0000-4000-8000-000000000002";
const SOFIA = "00000000-0000-4000-8000-000000000003";

function form(
  values: Record<string, string>,
  participants = [ANA, LUIS, SOFIA],
) {
  const data = new FormData();
  Object.entries({
    group_id: GROUP,
    event_id: EVENT,
    paid_by: LUIS,
    description: "Supermercado",
    category: "comida",
    ...values,
  }).forEach(([key, value]) => data.set(key, value));
  participants.forEach((id) => data.append("participants", id));
  return data;
}

describe("money helpers", () => {
  it.each([
    ["36", 3600],
    ["36.5", 3650],
    ["36,50", 3650],
    ["0.01", 1],
  ])("reads %s as %i cents", (value, cents) => {
    expect(toCents(value)).toBe(cents);
  });
  it.each(["", "abc", "-5", "1.234", "1e3"])("rejects %s", (value) => {
    expect(toCents(value)).toBeNull();
  });
  it("keeps the sign of database amounts", () => {
    expect(amountToCents(-30)).toBe(-3000);
    expect(amountToCents("12.345")).toBe(1235);
    expect(amountToCents(null)).toBe(0);
  });
  it("formats signed amounts", () => {
    expect(formatMoney(5200)).toBe("$52.00");
    expect(formatMoney(-5200)).toBe("−$52.00");
  });
});

describe("equalShares", () => {
  it("never loses cents", () => {
    const shares = equalShares(1000, [ANA, LUIS, SOFIA]);
    expect(shares.map((share) => share.cents)).toEqual([334, 333, 333]);
    expect(shares.reduce((sum, share) => sum + share.cents, 0)).toBe(1000);
  });
});

describe("parseExpenseForm", () => {
  it("splits equally by default", () => {
    const result = parseExpenseForm(form({ amount: "90" }));
    expect("data" in result && result.data.shares).toEqual([
      { user_id: ANA, amount: 30 },
      { user_id: LUIS, amount: 30 },
      { user_id: SOFIA, amount: 30 },
    ]);
  });

  it("accepts custom amounts that add up", () => {
    const result = parseExpenseForm(
      form(
        {
          amount: "36",
          split: "custom",
          [`share_${ANA}`]: "20",
          [`share_${LUIS}`]: "16",
        },
        [ANA, LUIS],
      ),
    );
    expect("data" in result && result.data.amount).toBe(36);
  });

  it("rejects custom amounts that do not add up", () => {
    const result = parseExpenseForm(
      form(
        {
          amount: "36",
          split: "custom",
          [`share_${ANA}`]: "20",
          [`share_${LUIS}`]: "10",
        },
        [ANA, LUIS],
      ),
    );
    expect("error" in result && result.error).toContain("suman $30.00");
  });

  it.each([
    [{ amount: "0" }, "monto"],
    [{ amount: "10", description: "" }, "Describe"],
    [{ amount: "10", paid_by: "nadie" }, "pagó"],
  ])("rejects invalid input %o", (values, message) => {
    const result = parseExpenseForm(form(values));
    expect("error" in result && result.error).toContain(message);
  });

  it("requires participants", () => {
    const result = parseExpenseForm(form({ amount: "10" }, []));
    expect("error" in result && result.error).toContain("al menos una persona");
  });

  it("falls back to the 'otro' category", () => {
    const result = parseExpenseForm(form({ amount: "10", category: "casino" }));
    expect("data" in result && result.data.category).toBe("otro");
  });

  it("parses valid idempotency_key", () => {
    const key = "e0000000-0000-4000-8000-000000000001";
    const result = parseExpenseForm(
      form({ amount: "10", idempotency_key: key }),
    );
    expect("data" in result && result.data.idempotency_key).toBe(key);
  });

  it("leaves idempotency_key undefined when omitted", () => {
    const result = parseExpenseForm(form({ amount: "10" }));
    expect("data" in result && result.data.idempotency_key).toBeUndefined();
  });

  it("rejects invalid idempotency_key", () => {
    const result = parseExpenseForm(
      form({ amount: "10", idempotency_key: "invalid-uuid" }),
    );
    expect("error" in result && result.error).toContain("idempotencia");
  });
});

describe("expenseError", () => {
  it("explains database rules", () => {
    expect(
      expenseError("23514", "expense shares must add up to the amount"),
    ).toContain("no suman");
    expect(expenseError("23514", "event is cancelled")).toContain("cancelada");
  });
});
