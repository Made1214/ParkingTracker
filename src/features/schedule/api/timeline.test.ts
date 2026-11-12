import { describe, expect, it } from "vitest";
import { annotateTimeline } from "./timeline";

const at = (time: string) => `2026-11-14T${time}:00Z`;
const item = (id: string, start: string, end: string | null = null) => ({
  id,
  title: id,
  starts_at: at(start),
  ends_at: end ? at(end) : null,
});
const now = (time: string) => Date.parse(at(time));

describe("annotateTimeline · actividad en curso", () => {
  const items = [
    item("Salida", "12:00", "13:00"),
    item("Almuerzo", "14:00"),
    item("Volley", "16:00"),
  ];

  it("marca la actividad dentro de su horario", () => {
    const result = annotateTimeline(items, now("12:30"));
    expect(result.map((i) => i.current)).toEqual([true, false, false]);
  });

  it("sin hora de fin dura hasta que empieza la siguiente", () => {
    expect(annotateTimeline(items, now("15:59")).map((i) => i.current)).toEqual(
      [false, true, false],
    );
  });

  it("la última sin fin dura una hora", () => {
    expect(annotateTimeline(items, now("16:59")).at(-1)?.current).toBe(true);
    expect(annotateTimeline(items, now("17:00")).at(-1)?.current).toBe(false);
  });

  it("entre actividades o antes de empezar no hay ninguna en curso", () => {
    expect(annotateTimeline(items, now("13:30")).some((i) => i.current)).toBe(
      false,
    );
    expect(annotateTimeline(items, now("09:00")).some((i) => i.current)).toBe(
      false,
    );
  });
});

describe("annotateTimeline · solapes", () => {
  it("avisa cuando dos actividades se cruzan, en ambas", () => {
    const result = annotateTimeline(
      [item("Playa", "10:00", "12:00"), item("Kayak", "11:00", "13:00")],
      0,
    );
    expect(result.map((i) => i.overlaps)).toEqual([["Kayak"], ["Playa"]]);
  });

  it("una actividad sin fin que empieza dentro de otra se cruza", () => {
    const result = annotateTimeline(
      [item("Playa", "10:00", "12:00"), item("Foto grupal", "11:00")],
      0,
    );
    expect(result[1].overlaps).toEqual(["Playa"]);
  });

  it("dos actividades a la misma hora se cruzan", () => {
    const result = annotateTimeline(
      [item("A", "10:00"), item("B", "10:00")],
      0,
    );
    expect(result[0].overlaps).toEqual(["B"]);
  });

  it("una que termina justo cuando empieza otra no se cruza", () => {
    const result = annotateTimeline(
      [item("A", "10:00", "11:00"), item("B", "11:00", "12:00")],
      0,
    );
    expect(result.every((i) => i.overlaps.length === 0)).toBe(true);
  });
});
