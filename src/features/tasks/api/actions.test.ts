import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { createTask, updateTask } from "./actions";

const groupId = "00000000-0000-0000-0000-000000000001";
const eventId = "00000000-0000-0000-0000-000000000002";
const taskId = "00000000-0000-0000-0000-000000000003";
const userId = "00000000-0000-0000-0000-000000000004";
// Ends at 2026-11-20 18:00 Panama time (UTC-5) -> 2026-11-20T23:00:00.000Z
const eventEndsAtIso = "2026-11-20T23:00:00.000Z";

function setup() {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const updateQuery = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: taskId }, error: null }),
  };
  const updateMock = vi.fn().mockReturnValue(updateQuery);

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "events") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              status: "published",
              ends_at: eventEndsAtIso,
            },
            error: null,
          }),
        };
      }
      if (table === "group_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { user_id: userId },
            error: null,
          }),
        };
      }
      if (table === "tasks") {
        return {
          insert: insertMock,
          update: updateMock,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  mocks.session.mockResolvedValue({
    user: { id: userId },
    supabase,
  });

  return { insertMock, updateMock };
}

beforeEach(() => {
  vi.resetAllMocks();
  // Ensure "now" is before eventEndsAt
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
});

describe("createTask", () => {
  it("creates a task with valid due_at", async () => {
    const { insertMock } = setup();
    const form = new FormData();
    form.set("group_id", groupId);
    form.set("event_id", eventId);
    form.set("title", "Comprar carbón");
    form.set("due_at", "2026-11-20T12:00");

    const result = await createTask({}, form);
    expect(result.success).toBe("Tarea creada.");
    expect(insertMock).toHaveBeenCalledWith({
      group_id: groupId,
      event_id: eventId,
      title: "Comprar carbón",
      assignee_id: null,
      due_at: "2026-11-20T17:00:00.000Z",
      created_by: userId,
    });
    expect(mocks.revalidate).toHaveBeenCalledWith(`/groups/${groupId}/events/${eventId}`);
  });

  it("rejects createTask when due_at is after event.ends_at", async () => {
    const { insertMock } = setup();
    const form = new FormData();
    form.set("group_id", groupId);
    form.set("event_id", eventId);
    form.set("title", "Recoger bebidas");
    form.set("due_at", "2026-11-20T19:00"); // 19:00 is after 18:00 Panama

    const result = await createTask({}, form);
    expect(result.error).toBe("La fecha límite no puede ser posterior al final de la salida.");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("creates a task with empty due_at", async () => {
    const { insertMock } = setup();
    const form = new FormData();
    form.set("group_id", groupId);
    form.set("event_id", eventId);
    form.set("title", "Reservar mesas");
    form.set("due_at", "");

    const result = await createTask({}, form);
    expect(result.success).toBe("Tarea creada.");
    expect(insertMock).toHaveBeenCalledWith({
      group_id: groupId,
      event_id: eventId,
      title: "Reservar mesas",
      assignee_id: null,
      due_at: null,
      created_by: userId,
    });
  });
});

describe("updateTask", () => {
  it("updates task with valid due_at", async () => {
    const { updateMock } = setup();
    const form = new FormData();
    form.set("group_id", groupId);
    form.set("event_id", eventId);
    form.set("task_id", taskId);
    form.set("status", "in_progress");
    form.set("due_at", "2026-11-20T15:00");

    const result = await updateTask({}, form);
    expect(result.success).toBe("Tarea actualizada.");
    expect(updateMock).toHaveBeenCalledWith({
      status: "in_progress",
      assignee_id: null,
      due_at: "2026-11-20T20:00:00.000Z",
    });
  });

  it("rejects updateTask when due_at is after event.ends_at", async () => {
    const { updateMock } = setup();
    const form = new FormData();
    form.set("group_id", groupId);
    form.set("event_id", eventId);
    form.set("task_id", taskId);
    form.set("status", "in_progress");
    form.set("due_at", "2026-11-20T21:00");

    const result = await updateTask({}, form);
    expect(result.error).toBe("La fecha límite no puede ser posterior al final de la salida.");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates task with empty due_at (clearing deadline)", async () => {
    const { updateMock } = setup();
    const form = new FormData();
    form.set("group_id", groupId);
    form.set("event_id", eventId);
    form.set("task_id", taskId);
    form.set("status", "done");
    form.set("due_at", "");

    const result = await updateTask({}, form);
    expect(result.success).toBe("Tarea actualizada.");
    expect(updateMock).toHaveBeenCalledWith({
      status: "done",
      assignee_id: null,
      due_at: null,
    });
  });

  it("omits due_at from update payload when form has no due_at key", async () => {
    const { updateMock } = setup();
    const form = new FormData();
    form.set("group_id", groupId);
    form.set("event_id", eventId);
    form.set("task_id", taskId);
    form.set("status", "done");

    const result = await updateTask({}, form);
    expect(result.success).toBe("Tarea actualizada.");
    expect(updateMock).toHaveBeenCalledWith({
      status: "done",
      assignee_id: null,
    });
  });
});
