import { describe, expect, it } from "vitest";
import { isOverdue } from "./overdue";

const now = Date.parse("2026-11-12T15:00:00Z");

describe("isOverdue", () => {
  it("marca las tareas abiertas con fecha pasada", () => {
    expect(isOverdue("2026-11-12T14:59:00Z", "pending", now)).toBe(true);
    expect(isOverdue("2026-11-01T00:00:00Z", "in_progress", now)).toBe(true);
  });
  it("no marca las completadas, las futuras ni las que no tienen fecha", () => {
    expect(isOverdue("2026-11-01T00:00:00Z", "done", now)).toBe(false);
    expect(isOverdue("2026-11-12T15:01:00Z", "pending", now)).toBe(false);
    expect(isOverdue(null, "pending", now)).toBe(false);
  });
});
