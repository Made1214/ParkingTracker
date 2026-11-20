import "server-only";
import { requireUser } from "@/features/auth";
import {
  createdAtCursor,
  olderThanCursor,
} from "@/shared/lib/created-at-cursor";

const PAGE_SIZE = 24;

/** Obtiene una página de fotos de la salida y la cuota del grupo. */
export async function getPhotos(
  groupId: string,
  eventId: string,
  cursor?: string,
) {
  const { supabase, user } = await requireUser(
    `/groups/${groupId}/events/${eventId}`,
  );
  const after = olderThanCursor(cursor);
  let query = supabase
    .from("photos")
    .select("id, uploaded_by, created_at, width, height")
    .eq("group_id", groupId)
    .eq("event_id", eventId);
  if (after) query = query.or(after);
  const [photos, members, usage, event] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE + 1),
    supabase
      .from("group_members")
      .select("user_id, role, profiles(display_name)")
      .eq("group_id", groupId),
    supabase
      .from("group_storage_usage")
      .select("bytes_used, bytes_quota")
      .eq("group_id", groupId)
      .maybeSingle(),
    supabase
      .from("events")
      .select("status")
      .eq("group_id", groupId)
      .eq("id", eventId)
      .maybeSingle(),
  ]);
  if (photos.error || members.error || usage.error || event.error)
    throw new Error("No se pudieron cargar las fotos.");
  const names = new Map(
    members.data.map((m) => [m.user_id, m.profiles?.display_name ?? "Miembro"]),
  );
  const isAdmin = members.data.some(
    (m) => m.user_id === user.id && m.role === "admin",
  );
  const canUpload =
    event.data?.status === "published" || event.data?.status === "finished";
  const page = photos.data.slice(0, PAGE_SIZE);
  return {
    canUpload,
    pastPage: !!after,
    nextCursor:
      photos.data.length > PAGE_SIZE
        ? createdAtCursor(page[PAGE_SIZE - 1])
        : null,
    usedBytes: usage.data?.bytes_used ?? 0,
    quotaBytes: usage.data?.bytes_quota ?? 104857600,
    photos: page.map((photo) => ({
      id: photo.id,
      author:
        photo.uploaded_by === user.id
          ? "Tú"
          : photo.uploaded_by
            ? (names.get(photo.uploaded_by) ?? "Ex miembro")
            : "Ex miembro",
      createdAt: photo.created_at,
      width: photo.width,
      height: photo.height,
      canDelete: canUpload && (photo.uploaded_by === user.id || isAdmin),
    })),
  };
}
