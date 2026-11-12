import type { ActionState } from "@/shared/lib/forms";

export type TaskStatus = "pending" | "in_progress" | "done";
export type TaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  dueAt: string | null;
  /** Fecha límite pasada y sin completar (calculado en el servidor). */
  overdue: boolean;
  canEdit: boolean;
  canEditDueAt: boolean;
};
export type TaskMember = { id: string; name: string; isYou: boolean };
export type TaskAction = (
  state: ActionState,
  form: FormData,
) => Promise<ActionState>;
export const statusLabels: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  done: "Completada",
};
