import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/supabase/server";
import { mediaConfigured, privateImageUrl } from "@/shared/cloudinary/server";

export async function avatarResponse(userId: string) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!z.guid().safeParse(userId).success)
    return new Response(null, { status: 404, headers });
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401, headers });
  // Profiles RLS permits only self and people who currently share a group.
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_public_id")
    .eq("id", userId)
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
