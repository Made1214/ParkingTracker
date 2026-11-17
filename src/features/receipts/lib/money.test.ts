import { describe, expect, it } from "vitest";
import { allocate, applyRate, formatBalboas, parseAmount } from "./money";

describe("allocate", () => {
  it("reparte sin perder centavos y de forma reproducible", () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocate(1000, [1, 1, 1])).toEqual(allocate(1000, [1, 1, 1]));
    expect(allocate(100, [1, 2, 3])).toEqual([17, 33, 50]);
    expect(allocate(1, [1, 1, 1, 1, 1, 1, 1, 1])).toEqual([
      1, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });
  it("da el resto a la mayor fracción, no al primero", () => {
    // 10 × 1/6 = 1.67, 10 × 5/6 = 8.33 → la parte de 1/6 tiene la mayor fracción.
    expect(allocate(10, [1, 5])).toEqual([2, 8]);
  });
  it("reparte negativos con signo y respeta pesos cero", () => {
    expect(allocate(-1000, [1, 1, 1])).toEqual([-334, -333, -333]);
    expect(allocate(500, [0, 1, 0])).toEqual([0, 500, 0]);
    expect(allocate(0, [0, 0])).toEqual([0, 0]);
  });
  it("no pierde precisión con importes y pesos grandes", () => {
    const parts = allocate(999_999_999, [999_999_937, 1, 3]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(999_999_999);
  });
  it("rechaza entradas inválidas", () => {
    expect(() => allocate(10.5, [1])).toThrow();
    expect(() => allocate(10, [])).toThrow();
    expect(() => allocate(10, [0, 0])).toThrow();
    expect(() => allocate(10, [-1, 2])).toThrow();
    expect(allocate(0, [])).toEqual([]);
  });
});

describe("parseAmount", () => {
  it.each([
    ["12.50", 1250],
    ["12,50", 1250],
    ["12.5", 1250],
    ["7", 700],
    ["B/. 7.00", 700],
    ["$4", 400],
    ["1,234.56", 123456],
    ["1.234,56", 123456],
    ["1.234.567", 123456700],
    ["-3.00", -300],
    ["3.00-", -300],
    ["(3.00)", -300],
    [".50", 50],
  ])("%s → %i", (raw, cents) => {
    expect(parseAmount(raw)?.cents).toBe(cents);
  });
  it("marca como ambiguo un único separador con tres decimales", () => {
    expect(parseAmount("1,234")).toEqual({ cents: 123400, ambiguous: true });
    expect(parseAmount("12.50")?.ambiguous).toBe(false);
  });
  it.each([
    "",
    "abc",
    "12.345.6",
    "1.234.56",
    "1,2,3",
    "12.",
    "1,23,456.00",
    "12a",
  ])("no adivina: %s → null", (raw) => expect(parseAmount(raw)).toBeNull());
});

describe("applyRate y formatBalboas", () => {
  it("redondea medio centavo hacia arriba", () => {
    expect(applyRate(5950, 700)).toBe(417);
    expect(applyRate(1000, 700)).toBe(70);
    expect(applyRate(-5950, 700)).toBe(-417);
  });
  it("formatea balboas", () => {
    expect(formatBalboas(123456)).toBe("B/.1,234.56");
    expect(formatBalboas(-5)).toBe("−B/.0.05");
  });
});
