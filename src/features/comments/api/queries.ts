import "server-only";
import { requireUser } from "@/features/auth";

/** Hilo de comentarios de una salida: raíces con sus respuestas. */
export async function getComments(groupId: string, eventId: string) {
  const { supabase, user } = await requireUser(
    `/groups/${groupId}/events/${eventId}`,
  );
  const [comments, members, event] = await Promise.all([
    supabase
      .from("comments")
      .select("id, parent_id, body, author_id, created_at, updated_at")
      .eq("group_id", groupId)
      .eq("event_id", eventId)
      .order("created_at"),
    supabase
      .from("group_members")
      .select("user_id, role, profiles(display_name)")
      .eq("group_id", groupId),
    supabase
      .from("events")
      .select("created_by, status")
      .eq("group_id", groupId)
      .eq("id", eventId)
      .maybeSingle(),
  ]);
  if (comments.error || members.error || event.error)
    throw new Error("No se pudieron cargar los comentarios.");

  const canComment =
    event.data?.status === "published" || event.data?.status === "finished";
  const names = new Map(
    members.data.map((m) => [m.user_id, m.profiles?.display_name ?? "Miembro"]),
  );
  const isAdmin = members.data.some(
    (m) => m.user_id === user.id && m.role === "admin",
  );
  const shape = (comment: (typeof comments.data)[number]) => ({
    id: comment.id,
    body: comment.body,
    author: comment.author_id
      ? (names.get(comment.author_id) ?? "Ex miembro")
      : "Ex miembro",
    mine: comment.author_id === user.id,
    organizer:
      !!comment.author_id && comment.author_id === event.data?.created_by,
    createdAt: comment.created_at,
    edited:
      Date.parse(comment.updated_at) - Date.parse(comment.created_at) > 1000,
    canEdit: canComment && comment.author_id === user.id,
    canDelete: canComment && (comment.author_id === user.id || isAdmin),
  });
  return {
    now: Date.now(),
    canComment,
    total: comments.data.length,
    threads: comments.data
      .filter((comment) => !comment.parent_id)
      .map((root) => ({
        ...shape(root),
        replies: comments.data
          .filter((comment) => comment.parent_id === root.id)
          .map(shape),
      })),
  };
}
