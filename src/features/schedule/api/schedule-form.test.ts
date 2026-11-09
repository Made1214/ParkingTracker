import { describe, expect, it } from "vitest";
import { parseScheduleForm, scheduleError } from "./schedule-form";

const GROUP = "10000000-0000-4000-8000-000000000001";
const EVENT = "20000000-0000-4000-8000-000000000001";

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries({ group_id: GROUP, event_id: EVENT, ...values }).forEach(
    ([key, value]) => data.set(key, value),
  );
  return data;
}

describe("parseScheduleForm", () => {
  it("converts Panama times to UTC", () => {
    const result = parseScheduleForm(
      form({
        title: " Salida ",
        starts_at: "2026-11-14T07:00",
        ends_at: "2026-11-14T08:00",
      }),
    );
    expect(result).toEqual({
      data: {
        group_id: GROUP,
        event_id: EVENT,
        title: "Salida",
        description: null,
        starts_at: "2026-11-14T12:00:00.000Z",
        ends_at: "2026-11-14T13:00:00.000Z",
        proposal_id: null,
      },
    });
  });

  it("allows an activity without end time", () => {
    const result = parseScheduleForm(
      form({ title: "Almuerzo", starts_at: "2026-11-14T12:30" }),
    );
    expect("data" in result && result.data.ends_at).toBeNull();
  });

  it.each([
    [{ title: "", starts_at: "2026-11-14T07:00" }, "título"],
    [{ title: "Salida", starts_at: "" }, "inicio"],
    [
      {
        title: "Salida",
        starts_at: "2026-11-14T08:00",
        ends_at: "2026-11-14T07:00",
      },
      "terminar después",
    ],
    [
      {
        title: "Salida",
        starts_at: "2026-11-14T08:00",
        proposal_id: "not-a-uuid",
      },
      "propuesta",
    ],
  ])("rejects invalid input %o", (values, message) => {
    const result = parseScheduleForm(form(values));
    expect("error" in result && result.error).toContain(message);
  });
});

describe("scheduleError", () => {
  it("explains database rules in Spanish", () => {
    expect(
      scheduleError("23514", "schedule item must fall within the event"),
    ).toContain("horario de la salida");
    expect(scheduleError("23505")).toContain("ya está en el cronograma");
    expect(scheduleError("42501")).toContain("organiza");
  });
});
