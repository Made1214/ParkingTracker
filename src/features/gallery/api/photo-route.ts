import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/supabase/server";
import { apiError } from "@/shared/lib/api-errors";
import { currentRequestId } from "@/shared/lib/request-id";
import { mediaConfigured, privateImageUrl } from "@/shared/cloudinary/server";

// Cada solicitud debe volver a comprobar la membresía.
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

/** Entrega una foto solo si RLS confirma que quien la pide es miembro. */
export async function photoResponse(
  groupId: string,
  eventId: string,
  photoId: string,
  thumbnail = false,
) {
  const requestId = await currentRequestId();
  if (
    ![groupId, eventId, photoId].every((id) => z.guid().safeParse(id).success)
  )
    return apiError("NOT_FOUND", { requestId, headers });
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHENTICATED", { requestId, headers });
  const { data: photo, error } = await supabase
    .from("photos")
    .select("cloudinary_public_id")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) return apiError("SERVICE_UNAVAILABLE", { requestId, headers });
  if (!photo) return apiError("NOT_FOUND", { requestId, headers });
  if (!mediaConfigured())
    return apiError("SERVICE_UNAVAILABLE", { requestId, headers });
  try {
    const url = thumbnail
      ? privateImageUrl(photo.cloudinary_public_id, true)
      : privateImageUrl(photo.cloudinary_public_id);
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const contentType = response.headers.get("content-type");
    if (!response.ok || !contentType?.startsWith("image/"))
      return apiError("UPSTREAM_ERROR", { requestId, headers });
    return new Response(response.body, {
      headers: { ...headers, "Content-Type": contentType },
    });
  } catch {
    return apiError("UPSTREAM_ERROR", { requestId, headers });
  }
}
