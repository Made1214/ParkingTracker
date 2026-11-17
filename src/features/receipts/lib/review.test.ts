import { describe, expect, it } from "vitest";
import { findRepeatedItems, receiptFingerprint } from "./review";
import { panamaTaxProfile } from "./tax-rules/panama";

const item = (id: string, name: string) => ({
  id,
  name,
  quantity: 1,
  unitPriceCents: null,
  lineTotalCents: 100,
});

describe("findRepeatedItems", () => {
  it("agrupa nombres iguales sin fusionarlos", () => {
    expect(
      findRepeatedItems([
        item("1", "Cerveza Balboa"),
        item("2", "cerveza  balboa"),
        item("3", "Té"),
      ]),
    ).toEqual([["1", "2"]]);
  });
});

describe("26. receiptFingerprint", () => {
  it("es igual para la misma factura aunque cambie el formato del comercio", () => {
    const a = receiptFingerprint({
      merchant: "Café Unido",
      date: "2026-11-16",
      totalCents: 1234,
    });
    const b = receiptFingerprint({
      merchant: "CAFE UNIDO ",
      date: "2026-11-16",
      totalCents: 1234,
    });
    expect(a).toBe(b);
    expect(
      receiptFingerprint({
        merchant: "Café Unido",
        date: "2026-11-16",
        totalCents: 1235,
      }),
    ).not.toBe(a);
  });
});

describe("panamaTaxProfile", () => {
  const s = panamaTaxProfile.suggest;
  it("tarifa general 7 % para comida en restaurante con alcohol", () => {
    expect(s("restaurant_with_alcohol", "food")).toMatchObject({
      rateBp: 700,
      needsConfirmation: false,
    });
  });
  it("alcohol servido: sugiere 10 % pero exige confirmación", () => {
    expect(s("restaurant_with_alcohol", "alcoholic_beverage")).toMatchObject({
      rateBp: 1000,
      needsConfirmation: true,
    });
    expect(s("bar", "alcoholic_beverage").needsConfirmation).toBe(true);
    expect(s("supermarket", "alcoholic_beverage")).toMatchObject({
      rateBp: 1000,
      needsConfirmation: false,
    });
  });
  it("local sin alcohol: exento, con confirmación", () => {
    expect(s("restaurant_without_alcohol", "food")).toMatchObject({
      rateId: null,
      rateBp: 0,
      needsConfirmation: true,
    });
  });
  it("básicos, tabaco y fuentes verificables", () => {
    expect(s("supermarket", "groceries_basic").rateBp).toBe(0);
    expect(s("bar", "tobacco").rateBp).toBe(1500);
    expect(s("other", "other").needsConfirmation).toBe(true);
    expect(
      panamaTaxProfile.sources.every((src) =>
        src.url.startsWith("https://dgi.mef.gob.pa/"),
      ),
    ).toBe(true);
  });
});
