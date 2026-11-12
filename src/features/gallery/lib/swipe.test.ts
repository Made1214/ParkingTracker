import { describe, expect, it } from "vitest";
import { swipeStep } from "./swipe";

describe("swipeStep", () => {
  it("hacia la izquierda pasa a la siguiente y a la derecha a la anterior", () => {
    expect(swipeStep(-80, 5)).toBe(1);
    expect(swipeStep(80, -5)).toBe(-1);
  });
  it("ignora toques y arrastres cortos", () => {
    expect(swipeStep(0, 0)).toBe(0);
    expect(swipeStep(-49, 0)).toBe(0);
  });
  it("ignora gestos mayormente verticales", () => {
    expect(swipeStep(-60, 50)).toBe(0);
    expect(swipeStep(90, 59)).toBe(-1);
  });
});
