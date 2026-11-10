import "server-only";
import { requireUser } from "@/features/auth";

type AttendanceStatus = "going" | "maybe" | "declined";
const cents = (value: number | string | null | undefined) =>
  Math.round(Number(value ?? 0) * 100);

/** Inicio: próximas salidas, pendientes propios y saldo en tus grupos. */
export async function getDashboard() {
  const { supabase, user } = await requireUser("/groups");
  const now = new Date().toISOString();

  const [groupsRes, profileRes, eventsRes, splitsRes] = await Promise.all([
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
      .gt("starts_at", now)
      .order("starts_at")
      .limit(7),
    supabase
      .from("expense_splits")
      .select("expenses!inner(event_id, paid_by, events(title, group_id))")
      .eq("user_id", user.id)
      .eq("settled", false)
      .limit(50),
  ]);
  if (groupsRes.error || profileRes.error || eventsRes.error || splitsRes.error)
    throw new Error("No se pudo cargar tu inicio.");

  const events = eventsRes.data;
  const eventIds = events.map((event) => event.id);
  const groups = groupsRes.data;

  const [attendanceRes, pollsRes, tasksRes, organizersRes, balances] =
    await Promise.all([
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
      supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", [
          ...new Set(events.map((e) => e.created_by).filter(Boolean)),
        ] as string[]),
      Promise.all(
        groups
          .slice(0, 8)
          .map((group) =>
            supabase.rpc("get_group_balances", { p_group_id: group.id }),
          ),
      ),
    ]);
  if (
    attendanceRes.error ||
    pollsRes.error ||
    tasksRes.error ||
    organizersRes.error ||
    balances.some((result) => result.error)
  )
    throw new Error("No se pudo cargar tu inicio.");

  // Deudas propias: solo en las salidas donde tienes partes sin saldar.
  const debtEvents = new Map<string, { title: string; groupId: string }>();
  for (const split of splitsRes.data) {
    const expense = split.expenses;
    if (expense.paid_by === user.id || !expense.events) continue;
    debtEvents.set(expense.event_id, {
      title: expense.events.title,
      groupId: expense.events.group_id,
    });
  }
  const debtEntries = [...debtEvents.entries()].slice(0, 4);
  const debtResults = await Promise.all(
    debtEntries.map(([eventId]) =>
      supabase.rpc("get_event_debts", { p_event_id: eventId }),
    ),
  );
  const creditorIds = new Set<string>();
  const debts = debtEntries.flatMap(([eventId, info], index) => {
    const mine = (debtResults[index].data ?? []).filter(
      (debt) => debt.debtor === user.id,
    );
    if (!mine.length) return [];
    mine.forEach((debt) => creditorIds.add(debt.creditor));
    return [
      {
        eventId,
        ...info,
        cents: mine.reduce((sum, debt) => sum + cents(debt.amount), 0),
        creditors: mine.map((debt) => debt.creditor),
      },
    ];
  });
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

  const balanceCents = balances.reduce(
    (sum, result) =>
      sum +
      cents(result.data?.find((row) => row.user_id === user.id)?.net_amount),
    0,
  );

  const nowMs = Date.parse(now);
  return {
    now,
    nextInMs: upcoming[0] ? Date.parse(upcoming[0].startsAt) - nowMs : null,
    displayName: profileRes.data?.display_name ?? "",
    groups,
    upcoming,
    todo,
    balanceCents,
  };
}

function money(value: number) {
  return `$${(value / 100).toFixed(2)}`;
}
