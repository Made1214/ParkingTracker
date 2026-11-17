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

/**
 * Imagen de una factura. RLS revalida la membresía en cada petición; la URL
 * firmada de Cloudinary (60 s) nunca llega al navegador.
 */
export async function receiptImageResponse(
  groupId: string,
  eventId: string,
  receiptId: string,
) {
  const requestId = await currentRequestId();
  if (
    ![groupId, eventId, receiptId].every((id) => z.guid().safeParse(id).success)
  )
    return apiError("NOT_FOUND", { requestId, headers });
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHENTICATED", { requestId, headers });
  const { data: receipt, error } = await supabase
    .from("receipts")
    .select("image_public_id")
    .eq("id", receiptId)
    .eq("group_id", groupId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) return apiError("SERVICE_UNAVAILABLE", { requestId, headers });
  if (!receipt?.image_public_id)
    return apiError("NOT_FOUND", { requestId, headers });
  if (!mediaConfigured())
    return apiError("SERVICE_UNAVAILABLE", { requestId, headers });
  try {
    const response = await fetch(privateImageUrl(receipt.image_public_id), {
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
