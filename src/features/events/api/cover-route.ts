import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/supabase/server";
import { mediaConfigured, privateImageUrl } from "@/shared/cloudinary/server";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function eventCoverResponse(groupId: string, eventId: string) {
  if (
    !z.guid().safeParse(groupId).success ||
    !z.guid().safeParse(eventId).success
  )
    return new Response(null, { status: 404, headers });
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401, headers });
  // RLS revalidates current membership on every image request, including after logout/removal.
  const { data: event, error } = await supabase
    .from("events")
    .select("cover_public_id")
    .eq("id", eventId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) return new Response(null, { status: 503, headers });
  if (!event?.cover_public_id)
    return new Response(null, { status: 404, headers });
  if (!mediaConfigured()) return new Response(null, { status: 503, headers });
  try {
    const response = await fetch(privateImageUrl(event.cover_public_id), {
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
