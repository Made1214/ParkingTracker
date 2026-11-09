import { describe, expect, it } from "vitest";
import {
  safeNext,
  dateLabel,
  panamaInput,
  fromPanamaInput,
  panamaTime,
  initials,
  countdown,
  shortDate,
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

describe("display helpers", () => {
  it("builds initials", () => {
    expect(initials("Ana Torres")).toBe("AT");
    expect(initials("luis")).toBe("LU");
    expect(initials("  ")).toBe("?");
  });
  it("formats countdowns", () => {
    expect(countdown((5 * 24 + 14) * 3600000 + 59000)).toBe("5d 14h");
    expect(countdown(3 * 3600000 + 20 * 60000)).toBe("3h 20min");
    expect(countdown(-1)).toBe("0min");
  });
  it("formats Panama dates", () => {
    expect(shortDate("2026-11-14T12:00:00Z")).toMatch(/sáb.*14.*nov/);
  });
});
