import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { createComment, deleteComment, updateComment } from "./actions";

const group = "10000000-0000-4000-8000-000000000001";
const event = "20000000-0000-4000-8000-000000000002";
const comment = "30000000-0000-4000-8000-000000000003";
const parent = "40000000-0000-4000-8000-000000000004";
const eventPath = `/groups/${group}/events/${event}`;

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

/** Cadena de PostgREST que termina resolviendo `result`. */
function commentsTable(result: { data: object | null; error: object | null }) {
  const query = {
    insert: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  mocks.session.mockResolvedValue({
    user: { id: "user" },
    supabase: { from: () => query },
  });
  return query;
}

beforeEach(() => vi.resetAllMocks());

describe("createComment", () => {
  it("posts a trimmed comment as the session user and revalidates", async () => {
    const query = commentsTable({ data: null, error: null });
    const result = await createComment(
      {},
      form({ group_id: group, event_id: event, body: " ¡Nos vemos allá! " }),
    );
    expect(result).toEqual({});
    expect(query.insert).toHaveBeenCalledWith({
      group_id: group,
      event_id: event,
      body: "¡Nos vemos allá!",
      parent_id: null,
      author_id: "user",
    });
    expect(mocks.revalidate).toHaveBeenCalledWith(eventPath);
  });
  it("attaches the parent identifier when replying", async () => {
    const query = commentsTable({ data: null, error: null });
    await createComment(
      {},
      form({
        group_id: group,
        event_id: event,
        body: "Voy",
        parent_id: parent,
      }),
    );
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: parent }),
    );
  });
  it.each([
    ["an empty body", { body: "   " }],
    ["an overlong body", { body: "x".repeat(2001) }],
  ])("rejects %s before writing", async (_name, values) => {
    const query = commentsTable({ data: null, error: null });
    const result = await createComment(
      {},
      form({ group_id: group, event_id: event, ...values }),
    );
    expect(result.error).toBe(
      "Escribe un comentario de hasta 2000 caracteres.",
    );
    expect(query.insert).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("rejects unknown event identifiers before writing", async () => {
    const query = commentsTable({ data: null, error: null });
    const result = await createComment(
      {},
      form({ group_id: group, event_id: "nope", body: "Hola" }),
    );
    expect(result.error).toContain("salida");
    expect(query.insert).not.toHaveBeenCalled();
  });
  it("rejects a malformed parent identifier before writing", async () => {
    const query = commentsTable({ data: null, error: null });
    const result = await createComment(
      {},
      form({ group_id: group, event_id: event, body: "Hola", parent_id: "no" }),
    );
    expect(result.error).toContain("comentario");
    expect(query.insert).not.toHaveBeenCalled();
  });
  it.each([
    ["23503", "Ese comentario ya no existe."],
    ["42501", "No tienes permiso para realizar esta acción."],
  ])("maps insert error %s to a friendly message", async (code, message) => {
    commentsTable({ data: null, error: { code } });
    const result = await createComment(
      {},
      form({
        group_id: group,
        event_id: event,
        body: "Hola",
        parent_id: parent,
      }),
    );
    expect(result.error).toBe(message);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

describe("updateComment", () => {
  it("edits the author's own comment and revalidates", async () => {
    const query = commentsTable({ data: { id: comment }, error: null });
    const result = await updateComment(
      {},
      form({
        group_id: group,
        event_id: event,
        id: comment,
        body: " Editado ",
      }),
    );
    expect(result.success).toContain("actualizado");
    expect(query.update).toHaveBeenCalledWith({ body: "Editado" });
    expect(query.eq).toHaveBeenCalledWith("id", comment);
    expect(query.eq).toHaveBeenCalledWith("group_id", group);
    expect(query.eq).toHaveBeenCalledWith("event_id", event);
    expect(mocks.revalidate).toHaveBeenCalledWith(eventPath);
  });
  it("refuses an edit that matches nothing (non-author or deleted)", async () => {
    const query = commentsTable({ data: null, error: null });
    const result = await updateComment(
      {},
      form({ group_id: group, event_id: event, id: comment, body: "Editado" }),
    );
    expect(result.error).toContain("tus propios comentarios");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("rejects an empty body before querying", async () => {
    const query = commentsTable({ data: { id: comment }, error: null });
    const result = await updateComment(
      {},
      form({ group_id: group, event_id: event, id: comment, body: " " }),
    );
    expect(result.error).toBe(
      "Escribe un comentario de hasta 2000 caracteres.",
    );
    expect(query.update).not.toHaveBeenCalled();
  });
  it.each([
    ["a malformed comment id", { id: "nope" }],
    ["a malformed event id", { id: comment, event_id: "nope" }],
  ])("rejects %s before querying", async (_name, values) => {
    const query = commentsTable({ data: { id: comment }, error: null });
    const result = await updateComment(
      {},
      form({ group_id: group, event_id: event, body: "Editado", ...values }),
    );
    expect(result.error).toContain("comentario");
    expect(query.update).not.toHaveBeenCalled();
  });
  it("maps a database failure to a friendly message", async () => {
    commentsTable({ data: null, error: { code: "XX000" } });
    const result = await updateComment(
      {},
      form({ group_id: group, event_id: event, id: comment, body: "Editado" }),
    );
    expect(result.error).toBe("No se pudo guardar. Inténtalo de nuevo.");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

describe("deleteComment", () => {
  it("deletes the author's own comment and revalidates", async () => {
    const query = commentsTable({ data: { id: comment }, error: null });
    const result = await deleteComment(
      {},
      form({ group_id: group, event_id: event, id: comment }),
    );
    expect(result).toEqual({});
    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenCalledWith("id", comment);
    expect(mocks.revalidate).toHaveBeenCalledWith(eventPath);
  });
  it("refuses a deletion that matches nothing (non-author or deleted)", async () => {
    commentsTable({ data: null, error: null });
    const result = await deleteComment(
      {},
      form({ group_id: group, event_id: event, id: comment }),
    );
    expect(result.error).toContain("permiso");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("rejects malformed identifiers before querying", async () => {
    const query = commentsTable({ data: { id: comment }, error: null });
    const result = await deleteComment(
      {},
      form({ group_id: group, event_id: "nope", id: comment }),
    );
    expect(result.error).toContain("comentario");
    expect(query.delete).not.toHaveBeenCalled();
  });
  it("maps a database failure to a friendly message", async () => {
    commentsTable({ data: null, error: { code: "42501" } });
    const result = await deleteComment(
      {},
      form({ group_id: group, event_id: event, id: comment }),
    );
    expect(result.error).toBe("No tienes permiso para realizar esta acción.");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
