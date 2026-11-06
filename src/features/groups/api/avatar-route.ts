import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/supabase/server";
import { mediaConfigured, privateImageUrl } from "@/shared/cloudinary/server";
export async function groupAvatarResponse(groupId: string) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!z.uuid().safeParse(groupId).success)
    return new Response(null, { status: 404, headers });
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401, headers });
  const { data, error } = await supabase
    .from("groups")
    .select("avatar_public_id")
    .eq("id", groupId)
    .maybeSingle();
  if (error) return new Response(null, { status: 503, headers });
  if (!data?.avatar_public_id)
    return new Response(null, { status: 404, headers });
  if (!mediaConfigured()) return new Response(null, { status: 503, headers });
  try {
    const response = await fetch(privateImageUrl(data.avatar_public_id), {
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
