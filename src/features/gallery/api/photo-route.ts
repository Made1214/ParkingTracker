import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/supabase/server";
import { mediaConfigured, privateImageUrl } from "@/shared/cloudinary/server";

// Las fotos no cambian: caché solo en el navegador de quien ya pudo verlas.
const headers = {
  "Cache-Control": "private, max-age=600",
  "X-Content-Type-Options": "nosniff",
};

/** Entrega una foto solo si RLS confirma que quien la pide es miembro. */
export async function photoResponse(
  groupId: string,
  eventId: string,
  photoId: string,
) {
  if (
    ![groupId, eventId, photoId].every((id) => z.guid().safeParse(id).success)
  )
    return new Response(null, { status: 404, headers });
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401, headers });
  const { data: photo, error } = await supabase
    .from("photos")
    .select("cloudinary_public_id")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) return new Response(null, { status: 503, headers });
  if (!photo) return new Response(null, { status: 404, headers });
  if (!mediaConfigured()) return new Response(null, { status: 503, headers });
  try {
    const response = await fetch(privateImageUrl(photo.cloudinary_public_id), {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/")
    )
      return new Response(null, { status: 502, headers });
    return new Response(response.body, {
      headers: { ...headers, "Content-Type": "image/webp" },
    });
  } catch {
    return new Response(null, { status: 502, headers });
  }
}
