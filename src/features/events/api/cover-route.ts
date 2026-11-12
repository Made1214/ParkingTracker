import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/supabase/server";
import { apiError } from "@/shared/lib/api-errors";
import { currentRequestId } from "@/shared/lib/request-id";
import { mediaConfigured, privateImageUrl } from "@/shared/cloudinary/server";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function eventCoverResponse(groupId: string, eventId: string) {
  const requestId = await currentRequestId();
  if (
    !z.guid().safeParse(groupId).success ||
    !z.guid().safeParse(eventId).success
  )
    return apiError("NOT_FOUND", { requestId, headers });
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHENTICATED", { requestId, headers });
  // RLS revalidates current membership on every image request, including after logout/removal.
  const { data: event, error } = await supabase
    .from("events")
    .select("cover_public_id")
    .eq("id", eventId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) return apiError("SERVICE_UNAVAILABLE", { requestId, headers });
  if (!event?.cover_public_id)
    return apiError("NOT_FOUND", { requestId, headers });
  if (!mediaConfigured())
    return apiError("SERVICE_UNAVAILABLE", { requestId, headers });
  try {
    const response = await fetch(privateImageUrl(event.cover_public_id), {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/")
    )
      return apiError("UPSTREAM_ERROR", { requestId, headers });
    return new Response(response.body, {
      headers: { ...headers, "Content-Type": "image/webp" },
    });
  } catch {
    return apiError("UPSTREAM_ERROR", { requestId, headers });
  }
}
