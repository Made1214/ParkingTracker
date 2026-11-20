import { getAttendance } from "../api/queries";
import { AttendanceRealtime } from "./attendance-realtime";
import { AttendanceView } from "./attendance-view";
// Muestra la asistencia y escucha cambios mientras se pueden enviar respuestas.
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
    <>
      {open && <AttendanceRealtime eventId={eventId} />}
      <AttendanceView
        groupId={groupId}
        eventId={eventId}
        userId={userId}
        open={open}
        attendance={attendance}
      />
    </>
  );
}
