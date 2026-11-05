"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ClipboardList,
  ListChecks,
  LockKeyhole,
  Plus,
  X,
} from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import type { ActionState } from "@/shared/lib/forms";
import { TaskRow } from "./task-row";
import type {
  TaskAction,
  TaskItem,
  TaskMember,
  TaskStatus,
} from "./task-types";
import styles from "./tasks.module.css";

type Filter = "all" | "open" | "done";

export function TaskBoard({
  groupId,
  eventId,
  tasks,
  members,
  readOnly,
  createAction,
  updateAction,
}: {
  groupId: string;
  eventId: string;
  tasks: TaskItem[];
  members: TaskMember[];
  readOnly: boolean;
  createAction: TaskAction;
  updateAction: TaskAction;
}) {
  const id = useId();
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const addButton = useRef<HTMLButtonElement>(null);
  const activeFilter = useRef<HTMLButtonElement>(null);
  const restoreFilterFocus = useRef(false);
  const restoreAddFocus = useRef(false);
  const completed = tasks.filter((task) => task.status === "done").length;
  const open = tasks.length - completed;
  const visible = tasks.filter((task) =>
    filter === "all"
      ? true
      : filter === "done"
        ? task.status === "done"
        : task.status !== "done",
  );
  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Todas", count: tasks.length },
    { value: "open", label: "Por hacer", count: open },
    { value: "done", label: "Completadas", count: completed },
  ];

  function onTaskSaved(status: TaskStatus, title: string) {
    const leavesFilter =
      (filter === "open" && status === "done") ||
      (filter === "done" && status !== "done");
    // Keep keyboard focus in the list controls when a saved row is filtered out.
    if (leavesFilter) restoreFilterFocus.current = true;
    setAnnouncement(
      status === "done" ? `Completada: ${title}.` : `Actualizada: ${title}.`,
    );
  }

  useEffect(() => {
    if (pendingCount > 0) return;
    if (restoreFilterFocus.current) {
      activeFilter.current?.focus();
      restoreFilterFocus.current = false;
    }
    if (restoreAddFocus.current) {
      addButton.current?.focus();
      restoreAddFocus.current = false;
    }
  }, [pendingCount]);

  async function runAction(
    action: TaskAction,
    state: ActionState,
    data: FormData,
  ) {
    try {
      return await action(state, data);
    } finally {
      setPendingCount((count) => count - 1);
    }
  }

  return (
    <Card className={styles.board} aria-labelledby={`${id}-heading`}>
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <span className={styles.headingIcon} aria-hidden="true">
            <ListChecks size={24} />
          </span>
          <div>
            <h2 id={`${id}-heading`}>Tareas</h2>
            <p>Reparte lo que hace falta antes de la salida.</p>
          </div>
        </div>
        {!readOnly && (
          <Button
            ref={addButton}
            className={styles.addButton}
            type="button"
            disabled={pendingCount > 0}
            aria-expanded={adding}
            aria-controls={`${id}-composer`}
            onClick={() => setAdding(!adding)}
          >
            {adding ? (
              <X size={17} aria-hidden="true" />
            ) : (
              <Plus size={18} aria-hidden="true" />
            )}
            {adding ? "Cerrar" : "Añadir tarea"}
          </Button>
        )}
      </header>

      {tasks.length > 0 && (
        <div className={styles.progressBlock}>
          <div className={styles.progressCaption}>
            <span>
              <strong>
                {completed} de {tasks.length}
              </strong>{" "}
              completadas
            </span>
            <span>{open === 0 ? "¡Todo listo!" : `${open} por resolver`}</span>
          </div>
          <progress
            className={styles.progress}
            value={completed}
            max={tasks.length}
            aria-label="Tareas completadas"
          />
        </div>
      )}

      {adding && !readOnly && (
        <TaskComposer
          id={`${id}-composer`}
          groupId={groupId}
          eventId={eventId}
          members={members}
          action={(state, data) => runAction(createAction, state, data)}
          onPending={() => setPendingCount((count) => count + 1)}
          onCancel={() => {
            setAdding(false);
            addButton.current?.focus();
          }}
          onCreated={() => {
            setFilter("all");
            setAdding(false);
            setAnnouncement("Tarea añadida al plan.");
            restoreAddFocus.current = true;
          }}
        />
      )}

      {tasks.length > 0 && (
        <div
          className={styles.filters}
          role="group"
          aria-label="Filtrar tareas"
        >
          {filters.map((item) => (
            <button
              type="button"
              key={item.value}
              ref={filter === item.value ? activeFilter : undefined}
              className={styles.filter}
              aria-pressed={filter === item.value}
              disabled={pendingCount > 0}
              onClick={() => {
                setFilter(item.value);
                setAnnouncement("");
              }}
            >
              {item.label}
              <span>{item.count}</span>
            </button>
          ))}
        </div>
      )}

      {visible.length > 0 ? (
        <ul className={styles.list} aria-label="Tareas del evento">
          {visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              members={members}
              groupId={groupId}
              eventId={eventId}
              action={(state, data) => runAction(updateAction, state, data)}
              onPending={() => setPendingCount((count) => count + 1)}
              onSaved={onTaskSaved}
              readOnly={readOnly}
            />
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            {filter === "open" && tasks.length > 0 ? (
              <Check size={26} />
            ) : (
              <ClipboardList size={26} />
            )}
          </span>
          <h3>
            {tasks.length === 0
              ? "Un buen plan se hace entre todos"
              : filter === "open"
                ? "Todo listo para la salida"
                : "Todavía no hay tareas completadas"}
          </h3>
          <p>
            {tasks.length === 0
              ? readOnly
                ? "No se añadieron tareas a este evento."
                : "Añade la primera tarea y elige quién se encarga."
              : filter === "open"
                ? "Ya resolvieron todas las tareas de este evento."
                : "Las tareas que terminen aparecerán aquí."}
          </p>
          {tasks.length > 0 && (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => setFilter("all")}
            >
              Ver todas las tareas
            </button>
          )}
        </div>
      )}

      <div className={styles.footer}>
        {readOnly ? (
          <span>
            <LockKeyhole size={14} aria-hidden="true" /> Este evento es de solo
            lectura.
          </span>
        ) : (
          <span>
            <Check size={15} aria-hidden="true" /> Marca una tarea cuando esté
            lista.
          </span>
        )}
        <span role="status" aria-live="polite" className={styles.announcement}>
          {announcement}
        </span>
      </div>
    </Card>
  );
}

function TaskComposer({
  id,
  groupId,
  eventId,
  members,
  action,
  onPending,
  onCancel,
  onCreated,
}: {
  id: string;
  groupId: string;
  eventId: string;
  members: TaskMember[];
  action: TaskAction;
  onPending: () => void;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [state, formAction, pending] = useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await action(previous, data);
      if (result.success) onCreated();
      return result;
    },
    {},
  );
  return (
    <form
      id={id}
      action={formAction}
      className={styles.composer}
      aria-label="Añadir tarea"
      aria-busy={pending}
      onSubmit={onPending}
      // React resets form controls after resolved actions, including errors.
      // Keep the draft until creation succeeds and this composer closes.
      onReset={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="event_id" value={eventId} />
      <fieldset disabled={pending}>
        <legend>Nueva tarea</legend>
        <div className={styles.createFields}>
          <label className={styles.titleField}>
            ¿Qué hace falta?
            <Input
              autoFocus
              name="title"
              required
              maxLength={120}
              placeholder="Por ejemplo, comprar hielo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Responsable
            <span className={styles.selectWrap}>
              <select
                className="input"
                name="assignee_id"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value="">Sin asignar</option>
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
          <Button type="submit" disabled={pending || !title.trim()}>
            <Plus size={17} aria-hidden="true" />
            {pending ? "Añadiendo…" : "Añadir tarea"}
          </Button>
        </div>
      </fieldset>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
