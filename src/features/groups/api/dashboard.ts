import "server-only";
import { requireUser } from "@/features/auth";

type AttendanceStatus = "going" | "maybe" | "declined";
const cents = (value: number | string | null | undefined) =>
  Math.round(Number(value ?? 0) * 100);

/** Inicio: próximas salidas, pendientes propios y saldo en tus grupos. */
export async function getDashboard() {
  const { supabase, user } = await requireUser("/groups");
  const now = new Date().toISOString();

  const [groupsRes, profileRes, eventsRes, balanceRes, debtsRes] =
    await Promise.all([
      supabase
        .from("groups")
        .select("id, name")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("events")
        .select(
          "id, group_id, title, starts_at, ends_at, location, created_by, groups(name)",
        )
        .eq("status", "published")
        .gt("ends_at", now)
        .order("starts_at")
        .limit(7),
      supabase.rpc("get_dashboard_balance"),
      supabase.rpc("get_dashboard_debts"),
    ]);
  if (
    groupsRes.error ||
    profileRes.error ||
    eventsRes.error ||
    balanceRes.error ||
    debtsRes.error
  )
    throw new Error("No se pudo cargar tu inicio.");

  const events = eventsRes.data;
  const eventIds = events.map((event) => event.id);
  const groups = groupsRes.data;
  const organizerIds = [
    ...new Set(
      events.flatMap((event) => (event.created_by ? [event.created_by] : [])),
    ),
  ];

  const [attendanceRes, pollsRes, tasksRes, organizersRes] = await Promise.all([
    eventIds.length
      ? supabase
          .from("event_attendance")
          .select("event_id, user_id, status, profiles(display_name)")
          .in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? supabase
          .from("polls")
          .select("id, event_id, group_id, question, poll_votes(user_id)")
          .eq("status", "open")
          .in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? supabase
          .from("tasks")
          .select("id, title, event_id, group_id, status")
          .eq("assignee_id", user.id)
          .neq("status", "done")
          .in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    organizerIds.length
      ? supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", organizerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (
    attendanceRes.error ||
    pollsRes.error ||
    tasksRes.error ||
    organizersRes.error
  )
    throw new Error("No se pudo cargar tu inicio.");

  // La base entrega las deudas netas después de compensar los pagos de cada salida.
  const debts = debtsRes.data.map((row) => ({
    eventId: row.event_id,
    groupId: row.group_id,
    title: row.title,
    cents: cents(row.amount),
    creditors: row.creditors,
  }));
  const creditorIds = new Set(debts.flatMap((debt) => debt.creditors));
  const creditorNames = creditorIds.size
    ? ((
        await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", [...creditorIds])
      ).data ?? [])
    : [];
  const nameOf = (id: string) =>
    [...(organizersRes.data ?? []), ...creditorNames].find((p) => p.id === id)
      ?.display_name ?? "Miembro";

  const attendance = attendanceRes.data ?? [];
  const upcoming = events.map((event) => {
    const rows = attendance.filter((row) => row.event_id === event.id);
    const count = (status: AttendanceStatus) =>
      rows.filter((row) => row.status === status).length;
    return {
      id: event.id,
      groupId: event.group_id,
      groupName: event.groups?.name ?? "",
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      location: event.location,
      organizer: event.created_by
        ? event.created_by === user.id
          ? "Tú"
          : nameOf(event.created_by)
        : null,
      going: count("going"),
      maybe: count("maybe"),
      goingNames: rows
        .filter((row) => row.status === "going")
        .map((row) => row.profiles?.display_name ?? "Miembro"),
      mine: rows.find((row) => row.user_id === user.id)?.status,
    };
  });
  const titleOf = (eventId: string) =>
    upcoming.find((event) => event.id === eventId)?.title ?? "";

  const todo = [
    ...(pollsRes.data ?? [])
      .filter((poll) => !poll.poll_votes.some((v) => v.user_id === user.id))
      .map((poll) => ({
        kind: "poll" as const,
        id: poll.id,
        title: `Vota: ${poll.question}`,
        detail: titleOf(poll.event_id),
        href: `/groups/${poll.group_id}/events/${poll.event_id}?section=votaciones`,
      })),
    ...debts.map((debt) => ({
      kind: "debt" as const,
      id: debt.eventId,
      title:
        debt.creditors.length === 1
          ? `Debes ${money(debt.cents)} a ${nameOf(debt.creditors[0])}`
          : `Debes ${money(debt.cents)}`,
      detail: debt.title,
      href: `/groups/${debt.groupId}/events/${debt.eventId}?section=gastos`,
    })),
    ...(tasksRes.data ?? []).map((task) => ({
      kind: "task" as const,
      id: task.id,
      title: task.title,
      detail: `Tarea tuya · ${titleOf(task.event_id)}`,
      href: `/groups/${task.group_id}/events/${task.event_id}?section=tareas`,
    })),
  ];

  const nowMs = Date.parse(now);
  return {
    now,
    nextInMs: upcoming[0]
      ? Math.max(0, Date.parse(upcoming[0].startsAt) - nowMs)
      : null,
    displayName: profileRes.data?.display_name ?? "",
    groups,
    upcoming,
    todo,
    balanceCents: cents(balanceRes.data),
  };
}

function money(value: number) {
  return `$${(value / 100).toFixed(2)}`;
}
