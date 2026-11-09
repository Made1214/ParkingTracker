import { eventCoverResponse } from "@/features/events";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ groupId: string; eventId: string }> },
) {
  const { groupId, eventId } = await params;
  return eventCoverResponse(groupId, eventId);
}
