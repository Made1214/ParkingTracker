import { createTask, updateTask } from "../api/actions";
import { getTasks } from "../api/queries";
import { TaskBoard } from "./task-board";

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
  return (
    <TaskBoard
      groupId={groupId}
      eventId={eventId}
      readOnly={readOnly}
      tasks={tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        assigneeId: task.assignee_id,
        canEdit:
          !readOnly &&
          (isAdmin ||
            task.created_by === user.id ||
            task.assignee_id === user.id),
      }))}
      members={members.map((member) => ({
        id: member.user_id,
        name: member.profiles?.display_name || "Miembro",
        isYou: member.user_id === user.id,
      }))}
      createAction={createTask}
      updateAction={updateTask}
    />
  );
}
