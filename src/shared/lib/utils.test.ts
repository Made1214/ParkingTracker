import { describe, expect, it } from "vitest";
import { safeNext, dateLabel } from "./utils";
describe("auth redirect destination", () => {
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\nLocation: evil",
    null,
  ])("rejects external or malformed target %s", (target) => {
    expect(safeNext(target)).toBe("/groups");
  });
  it("preserves a private invitation through sign in", () => {
    expect(safeNext("/join/ABCD1234")).toBe("/join/ABCD1234");
  });
});
it("displays dates in Panama independently of the server timezone", () => {
  expect(dateLabel("2026-12-02T02:00:00Z")).toContain("1");
  expect(dateLabel("2026-12-02T02:00:00Z")).toContain("9:00");
});
