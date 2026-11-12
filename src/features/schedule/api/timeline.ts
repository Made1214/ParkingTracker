/** Duración asumida de la última actividad cuando no tiene hora de fin. */
const OPEN_ENDED_MS = 60 * 60 * 1000;

type Item = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
};

/**
 * Anota el cronograma (ya ordenado por hora) para la vista:
 *
 * - `current` (plan E5.F1.T2): la actividad que está ocurriendo ahora. Sin
 *   hora de fin, dura hasta que empieza la siguiente; la última, una hora.
 * - `overlaps` (E5.F1.T1): títulos de las actividades con las que se cruza.
 *   Es un aviso, no un bloqueo: dos cosas a la vez pueden ser intencionales.
 *   Una actividad sin fin cuenta como un instante en su hora de inicio.
 */
export function annotateTimeline<T extends Item>(items: T[], now: number) {
  const span = items.map((item) => {
    const start = Date.parse(item.starts_at);
    return { start, end: item.ends_at ? Date.parse(item.ends_at) : start };
  });
  const crosses = (a: number, b: number) =>
    span[a].start === span[b].start ||
    (span[a].start < span[b].end && span[b].start < span[a].end);

  return items.map((item, index) => {
    const { start } = span[index];
    const next = items[index + 1];
    const currentUntil = item.ends_at
      ? span[index].end
      : next && Date.parse(next.starts_at) > start
        ? Date.parse(next.starts_at)
        : start + OPEN_ENDED_MS;
    return {
      ...item,
      current: start <= now && now < currentUntil,
      overlaps: items
        .filter((_, other) => other !== index && crosses(index, other))
        .map((other) => other.title),
    };
  });
}
