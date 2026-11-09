import { describe, expect, it } from "vitest";
import {
  safeNext,
  dateLabel,
  panamaInput,
  fromPanamaInput,
  panamaTime,
} from "./utils";
describe("auth redirect destination", () => {
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\nLocation: evil",
    null,
  ])("rejects external or malformed target %s", (target) => {
    expect(safeNext(target)).toBe("/");
  });
  it("preserves a private invitation through sign in", () => {
    expect(safeNext("/join/ABCD1234")).toBe("/join/ABCD1234");
  });
});
it("displays dates in Panama independently of the server timezone", () => {
  expect(dateLabel("2026-12-02T02:00:00Z")).toContain("1");
  expect(dateLabel("2026-12-02T02:00:00Z")).toContain("9:00");
});
describe("Panama date-time inputs", () => {
  it("round-trips a datetime-local value in Panama time", () => {
    const iso = fromPanamaInput("2026-11-14T08:30");
    expect(iso).toBe("2026-11-14T13:30:00.000Z");
    expect(panamaInput(iso!)).toBe("2026-11-14T08:30");
  });
  it("rejects malformed input", () => {
    expect(fromPanamaInput("14/11/2026 08:30")).toBeNull();
    expect(fromPanamaInput("")).toBeNull();
  });
  it("formats a short Panama time", () => {
    expect(panamaTime("2026-11-14T13:30:00Z")).toBe("08:30");
  });
});
