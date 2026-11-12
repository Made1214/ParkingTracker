import "server-only";
import { requireUser } from "@/features/auth";

/** Hilos que se muestran por página (docs/05-API §1: `limit` 20 por defecto). */
export const COMMENT_PAGE_SIZE = 20;
const MAX_THREADS = 200;

/** Normaliza `?comentarios=` a un múltiplo de la página, entre 20 y 200. */
export function commentLimit(value?: string | string[]) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isFinite(n) || n <= COMMENT_PAGE_SIZE) return COMMENT_PAGE_SIZE;
  return Math.min(
    MAX_THREADS,
    Math.ceil(n / COMMENT_PAGE_SIZE) * COMMENT_PAGE_SIZE,
  );
}

/**
 * Hilo de comentarios de una salida: los `limit` hilos más recientes con
 * todas sus respuestas (una respuesta solo puede colgar de una raíz).
 */
export async function getComments(
  groupId: string,
  eventId: string,
  limit = COMMENT_PAGE_SIZE,
) {
  const { supabase, user } = await requireUser(
    `/groups/${groupId}/events/${eventId}`,
  );
  const scope = () =>
    supabase
      .from("comments")
      .select("id, parent_id, body, author_id, created_at, updated_at")
      .eq("group_id", groupId)
      .eq("event_id", eventId);
  const [roots, total, members, event] = await Promise.all([
    // Uno de más para saber si hay hilos anteriores.
    scope()
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1),
    supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .eq("event_id", eventId),
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
  if (roots.error || total.error || members.error || event.error)
    throw new Error("No se pudieron cargar los comentarios.");
  const hasMore = roots.data.length > limit;
  const visibleRoots = roots.data.slice(0, limit).reverse();
  const replies = visibleRoots.length
    ? await scope()
        .in(
          "parent_id",
          visibleRoots.map((root) => root.id),
        )
        .order("created_at")
    : { data: [], error: null };
  if (replies.error) throw new Error("No se pudieron cargar los comentarios.");

  const canComment =
    event.data?.status === "published" || event.data?.status === "finished";
  const names = new Map(
    members.data.map((m) => [m.user_id, m.profiles?.display_name ?? "Miembro"]),
  );
  const isAdmin = members.data.some(
    (m) => m.user_id === user.id && m.role === "admin",
  );
  const shape = (comment: (typeof roots.data)[number]) => ({
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
    total: total.count ?? 0,
    hasMore,
    limit,
    threads: visibleRoots.map((root) => ({
      ...shape(root),
      replies: replies.data
        .filter((comment) => comment.parent_id === root.id)
        .map(shape),
    })),
  };
}
