import { createTask, updateTask } from "../api/actions";
import { getTasks } from "../api/queries";
import { isOverdue } from "../api/overdue";
import type React from "react";
import { Card } from "@/shared/ui/card";
import { initials, panamaInput } from "@/shared/lib/utils";
import { TaskBoard } from "./task-board";
import styles from "./tasks.module.css";
import { Motion } from "@/shared/ui/motion";

export async function TasksPanel({
  groupId,
  eventId,
  readOnly,
}: {
  groupId: string;
  eventId: string;
  readOnly: boolean;
}) {
  const { tasks, members, event, user } = await getTasks(groupId, eventId);
  const now = Date.now();
  const isAdmin = members.some(
    (member) => member.user_id === user.id && member.role === "admin",
  );
  const done = tasks.filter((task) => task.status === "done").length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const people = members
    .map((member) => {
      const own = tasks.filter((task) => task.assignee_id === member.user_id);
      return {
        id: member.user_id,
        name:
          member.user_id === user.id
            ? "Tú"
            : member.profiles?.display_name || "Miembro",
        total: own.length,
        done: own.filter((task) => task.status === "done").length,
      };
    })
    .filter((person) => person.total > 0)
    .sort((a, b) => b.total - a.total);
  const unassigned = tasks.filter(
    (task) => !task.assignee_id && task.status !== "done",
  ).length;
  const mine = tasks.filter(
    (task) => task.assignee_id === user.id && task.status !== "done",
  );

  return (
    <div className={styles.layout}>
      <TaskBoard
        groupId={groupId}
        eventId={eventId}
        eventEndsAt={panamaInput(event.ends_at)}
        readOnly={readOnly}
        tasks={tasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          assigneeId: task.assignee_id,
          dueAt: task.due_at,
          overdue: isOverdue(task.due_at, task.status, now),
          canEdit:
            !readOnly &&
            (isAdmin ||
              task.created_by === user.id ||
              task.assignee_id === user.id),
          canEditDueAt: !readOnly && (isAdmin || task.created_by === user.id),
        }))}
        members={members.map((member) => ({
          id: member.user_id,
          name: member.profiles?.display_name || "Miembro",
          isYou: member.user_id === user.id,
        }))}
        createAction={createTask}
        updateAction={updateTask}
      />
      <Motion>
        <aside className={styles.side} aria-label="Resumen de tareas">
          <Card className={styles.summary}>
            <span
              className={styles.ring}
              style={{ "--percent": `${percent}%` } as React.CSSProperties}
              aria-hidden="true"
            >
              <span data-count>{percent}%</span>
            </span>
            <div>
              <span className="eyebrow">PROGRESO</span>
              <strong className={styles.summaryCount} data-count="first">
                {done}/{tasks.length}
              </strong>
              <p className="small muted">
                {tasks.length === 0
                  ? "Aún no hay tareas."
                  : done === tasks.length
                    ? "¡Todo listo para salir!"
                    : `${tasks.length - done} por resolver`}
              </p>
            </div>
          </Card>
          <Card>
            <h3 className={styles.sideTitle}>Quién lleva qué</h3>
            {people.length ? (
              <ul className={styles.people}>
                {people.map((person) => (
                  <li key={person.id}>
                    <span className={styles.face} aria-hidden="true">
                      {initials(person.name)}
                    </span>
                    <span className={styles.personInfo}>
                      <strong>{person.name}</strong>
                      <span className={styles.miniBar} aria-hidden="true">
                        <span
                          data-grow="x"
                          style={{
                            width: `${(person.done / person.total) * 100}%`,
                          }}
                        />
                      </span>
                    </span>
                    <span className="small muted">
                      {person.done}/{person.total}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">
                Asigna responsables para ver aquí cómo va cada quien.
              </p>
            )}
            {unassigned > 0 && (
              <p className={styles.unassigned}>
                {unassigned}{" "}
                {unassigned === 1
                  ? "tarea sin responsable"
                  : "tareas sin responsable"}
              </p>
            )}
          </Card>
          <Card className={styles.mine}>
            <h3 className={styles.sideTitle}>Lo tuyo</h3>
            {mine.length ? (
              <ul>
                {mine.map((task) => (
                  <li key={task.id}>
                    <span className={styles.dot} data-status={task.status} />
                    {task.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">No tienes tareas pendientes.</p>
            )}
          </Card>
        </aside>
      </Motion>
    </div>
  );
}
