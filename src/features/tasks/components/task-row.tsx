"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronDown,
  Circle,
  CircleDot,
  LoaderCircle,
  Pencil,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { ActionState } from "@/shared/lib/forms";
import {
  statusLabels,
  type TaskAction,
  type TaskItem,
  type TaskMember,
  type TaskStatus,
} from "./task-types";
import styles from "./tasks.module.css";

const statusIcons = { pending: Circle, in_progress: CircleDot, done: Check };

export function TaskRow({
  task,
  members,
  groupId,
  eventId,
  action,
  onPending,
  onSaved,
  readOnly,
}: {
  task: TaskItem;
  members: TaskMember[];
  groupId: string;
  eventId: string;
  action: TaskAction;
  onPending: () => void;
  onSaved: (status: TaskStatus, title: string) => void;
  readOnly: boolean;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(task.status);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");
  const editButton = useRef<HTMLButtonElement>(null);
  const completeButton = useRef<HTMLButtonElement>(null);
  const titleHeading = useRef<HTMLHeadingElement>(null);
  const firstOption = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef<"edit" | "complete" | null>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await action(previous, data);
      if (result.success) {
        restoreFocus.current = editing ? "edit" : "complete";
        setEditing(false);
        onSaved(data.get("status") as TaskStatus, task.title);
      }
      return result;
    },
    {},
  );
  const assignee = members.find((member) => member.id === task.assigneeId);
  const unavailable = !!task.assigneeId && !assignee;
  const canEdit = task.canEdit && !readOnly;
  const Icon = statusIcons[task.status];
  const name =
    assignee?.name ??
    (task.assigneeId ? "Miembro no disponible" : "Sin asignar");
  const changed =
    status !== task.status || assigneeId !== (task.assigneeId ?? "");

  useEffect(() => {
    if (editing) firstOption.current?.focus();
    else if (restoreFocus.current && !pending) {
      const target =
        restoreFocus.current === "edit" ? editButton : completeButton;
      (target.current ?? titleHeading.current)?.focus();
      restoreFocus.current = null;
    }
  }, [editing, pending]);

  function closeEditor() {
    setEditing(false);
    editButton.current?.focus();
  }

  function toggleDone() {
    onPending();
    const data = new FormData();
    data.set("group_id", groupId);
    data.set("event_id", eventId);
    data.set("task_id", task.id);
    data.set("assignee_id", task.assigneeId ?? "");
    data.set("status", task.status === "done" ? "pending" : "done");
    startTransition(() => formAction(data));
  }

  return (
    <li
      className={styles.item}
      data-status={task.status}
      data-editing={editing || undefined}
    >
      <div className={styles.row}>
        {canEdit ? (
          <button
            type="button"
            className={styles.completeButton}
            ref={completeButton}
            onClick={toggleDone}
            disabled={pending || editing || unavailable}
            aria-pressed={task.status === "done"}
            aria-label={`${task.status === "done" ? "Marcar como pendiente" : "Completar"}: ${task.title}`}
          >
            <span>
              {pending && !editing ? (
                <LoaderCircle
                  size={19}
                  className={styles.spinner}
                  aria-hidden="true"
                />
              ) : (
                <Icon size={18} aria-hidden="true" />
              )}
            </span>
          </button>
        ) : (
          <span className={styles.staticStatus} aria-hidden="true">
            <span>
              <Icon size={18} />
            </span>
          </span>
        )}
        <div className={styles.taskTitle}>
          <h3 ref={titleHeading} tabIndex={-1}>
            {task.title}
          </h3>
          {canEdit && unavailable && (
            <p>Reasigna esta tarea para actualizarla.</p>
          )}
        </div>
        <span className={styles.statusBadge} data-status={task.status}>
          <Icon size={13} aria-hidden="true" />
          {statusLabels[task.status]}
        </span>
        <span className={styles.assignee}>
          <span
            className={styles.avatar}
            data-unassigned={!assignee || undefined}
            aria-hidden="true"
          >
            {assignee ? (
              assignee.name.trim().slice(0, 1).toLocaleUpperCase("es")
            ) : (
              <UserRound size={14} />
            )}
          </span>
          <span>
            {name}
            {assignee?.isYou && <span className={styles.you}> · tú</span>}
          </span>
        </span>
        {canEdit && (
          <button
            ref={editButton}
            type="button"
            className={styles.editButton}
            disabled={pending}
            aria-label={`${editing ? "Cerrar edición de" : "Editar"}: ${task.title}`}
            aria-expanded={editing}
            aria-controls={`${id}-editor`}
            onClick={() => {
              if (editing) closeEditor();
              else {
                setStatus(task.status);
                setAssigneeId(task.assigneeId ?? "");
                setEditing(true);
              }
            }}
          >
            {editing ? (
              <X size={17} aria-hidden="true" />
            ) : (
              <Pencil size={16} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {editing && canEdit && (
        <form
          id={`${id}-editor`}
          action={formAction}
          className={styles.editor}
          aria-label={`Editar: ${task.title}`}
          aria-busy={pending}
          onSubmit={onPending}
          onReset={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !pending) {
              event.preventDefault();
              closeEditor();
            }
          }}
        >
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="task_id" value={task.id} />
          <fieldset disabled={pending} className={styles.editFields}>
            <legend className="sr-only">Estado y responsable</legend>
            <fieldset className={styles.statusField}>
              <legend>Estado</legend>
              <div className={styles.statusOptions}>
                {(Object.keys(statusLabels) as TaskStatus[]).map((value) => {
                  const StatusIcon = statusIcons[value];
                  return (
                    <label
                      key={value}
                      className={styles.statusOption}
                      data-status={value}
                    >
                      <input
                        ref={value === status ? firstOption : undefined}
                        type="radio"
                        name="status"
                        value={value}
                        checked={status === value}
                        onChange={() => setStatus(value)}
                      />
                      <span>
                        <StatusIcon size={15} aria-hidden="true" />
                        {statusLabels[value]}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className={styles.assigneeField}>
              Responsable
              <span className={styles.selectWrap}>
                <select
                  className="input"
                  name="assignee_id"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {unavailable && (
                    <option value={task.assigneeId ?? ""} disabled>
                      Miembro no disponible
                    </option>
                  )}
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                      {member.isYou ? " (tú)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </span>
            </label>
            <div className={styles.editorActions}>
              <Button type="button" variant="ghost" onClick={closeEditor}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  pending ||
                  !changed ||
                  (!!assigneeId &&
                    !members.some((member) => member.id === assigneeId))
                }
              >
                {pending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
    </li>
  );
}
