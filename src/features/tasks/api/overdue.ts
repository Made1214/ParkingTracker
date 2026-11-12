/** Una tarea está vencida si tiene fecha límite pasada y no se completó (E8.F3.T2). */
export function isOverdue(
  dueAt: string | null,
  status: "pending" | "in_progress" | "done",
  now: number,
) {
  return !!dueAt && status !== "done" && Date.parse(dueAt) < now;
}
