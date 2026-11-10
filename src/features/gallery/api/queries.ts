import "server-only";
import { requireUser } from "@/features/auth";

/** Fotos de una salida (más recientes primero) y cuota del grupo. */
export async function getPhotos(groupId: string, eventId: string) {
  const { supabase, user } = await requireUser(
    `/groups/${groupId}/events/${eventId}`,
  );
  const [photos, members, usage, event] = await Promise.all([
    supabase
      .from("photos")
      .select("id, uploaded_by, created_at, width, height")
      .eq("group_id", groupId)
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
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
  return {
    canUpload:
      event.data?.status === "published" || event.data?.status === "finished",
    usedBytes: usage.data?.bytes_used ?? 0,
    quotaBytes: usage.data?.bytes_quota ?? 104857600,
    photos: photos.data.map((photo) => ({
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
      canDelete: photo.uploaded_by === user.id || isAdmin,
    })),
  };
}
