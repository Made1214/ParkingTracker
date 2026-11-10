import { photoResponse } from "@/features/gallery";

export async function GET(
  _: Request,
  {
    params,
  }: {
    params: Promise<{ groupId: string; eventId: string; photoId: string }>;
  },
) {
  const { groupId, eventId, photoId } = await params;
  return photoResponse(groupId, eventId, photoId);
}
