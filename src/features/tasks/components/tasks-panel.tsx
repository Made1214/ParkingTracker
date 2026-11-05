import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ActionForm } from "@/shared/ui/action-form";
import { createTask, updateTask } from "../api/actions";
import { getTasks } from "../api/queries";

const labels = {
  pending: "Pendiente",
  in_progress: "En progreso",
  done: "Completada",
} as const;

export async function TasksPanel({
  groupId,
  eventId,
  readOnly,
}: {
  groupId: string;
  eventId: string;
  readOnly: boolean;
}) {
  const { tasks, members, user } = await getTasks(groupId, eventId);
  const isAdmin = members.some(
    (member) => member.user_id === user.id && member.role === "admin",
  );
  const options = members.map((member) => ({
    id: member.user_id,
    name: member.profiles?.display_name ?? "Miembro",
  }));
  return (
    <Card>
      <span className="eyebrow">ORGANICEMOS EL PLAN</span>
      <h2>Tareas</h2>
      <p className="small muted">
        Reparte lo que hace falta antes de la salida.
      </p>
      {tasks.length === 0 ? (
        <p className="muted">Todavía no hay tareas.</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => {
            const canEdit =
              !readOnly &&
              (isAdmin ||
                task.created_by === user.id ||
                task.assignee_id === user.id);
            const assignee = options.find(
              (member) => member.id === task.assignee_id,
            );
            return (
              <li className="task-item" key={task.id}>
                <strong>{task.title}</strong>
                {!canEdit ? (
                  <p className="small muted">
                    {labels[task.status]} ·{" "}
                    {assignee?.name ??
                      (task.assignee_id
                        ? "Miembro no disponible"
                        : "Sin asignar")}
                  </p>
                ) : (
                  <ActionForm action={updateTask} label="Guardar cambios">
                    <input type="hidden" name="group_id" value={groupId} />
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="task_id" value={task.id} />
                    <label>
                      Estado
                      <select
                        className="input"
                        name="status"
                        defaultValue={task.status}
                      >
                        {Object.entries(labels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Asignada a
                      <select
                        className="input"
                        name="assignee_id"
                        defaultValue={task.assignee_id ?? ""}
                      >
                        <option value="">Sin asignar</option>
                        {task.assignee_id && !assignee && (
                          <option value={task.assignee_id}>
                            Miembro no disponible
                          </option>
                        )}
                        {options.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!readOnly && (
        <ActionForm action={createTask} label="Añadir tarea">
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="event_id" value={eventId} />
          <label>
            Nueva tarea
            <Input
              name="title"
              required
              maxLength={120}
              placeholder="Por ejemplo, comprar hielo"
            />
          </label>
          <label>
            Asignar a
            <select className="input" name="assignee_id" defaultValue="">
              <option value="">Sin asignar</option>
              {options.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        </ActionForm>
      )}
      {readOnly && (
        <p className="small muted">
          Las tareas de este evento son de solo lectura.
        </p>
      )}
    </Card>
  );
}
