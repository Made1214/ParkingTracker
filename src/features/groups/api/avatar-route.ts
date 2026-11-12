import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/supabase/server";
import { apiError } from "@/shared/lib/api-errors";
import { currentRequestId } from "@/shared/lib/request-id";
import { mediaConfigured, privateImageUrl } from "@/shared/cloudinary/server";
export async function groupAvatarResponse(groupId: string) {
  const requestId = await currentRequestId();
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!z.guid().safeParse(groupId).success)
    return apiError("NOT_FOUND", { requestId, headers });
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHENTICATED", { requestId, headers });
  const { data, error } = await supabase
    .from("groups")
    .select("avatar_public_id")
    .eq("id", groupId)
    .maybeSingle();
  if (error) return apiError("SERVICE_UNAVAILABLE", { requestId, headers });
  if (!data?.avatar_public_id)
    return apiError("NOT_FOUND", { requestId, headers });
  if (!mediaConfigured())
    return apiError("SERVICE_UNAVAILABLE", { requestId, headers });
  try {
    const response = await fetch(privateImageUrl(data.avatar_public_id), {
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
