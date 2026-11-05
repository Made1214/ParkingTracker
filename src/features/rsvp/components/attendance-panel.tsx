import { getAttendance } from "../api/queries";
import { AttendanceView } from "./attendance-view";
export async function AttendancePanel({
  groupId,
  eventId,
  userId,
  open,
}: {
  groupId: string;
  eventId: string;
  userId: string;
  open: boolean;
}) {
  const attendance = await getAttendance(groupId, eventId);
  return (
    <AttendanceView
      groupId={groupId}
      eventId={eventId}
      userId={userId}
      open={open}
      attendance={attendance}
    />
  );
}
