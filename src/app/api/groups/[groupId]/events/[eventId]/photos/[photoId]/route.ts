import { photoResponse } from "@/features/gallery";

// Entrega la foto completa o su miniatura mediante el proxy autenticado.
export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ groupId: string; eventId: string; photoId: string }>;
  },
) {
  const { groupId, eventId, photoId } = await params;
  const thumbnail = new URL(request.url).searchParams.get("size") === "thumb";
  return photoResponse(groupId, eventId, photoId, thumbnail);
}
