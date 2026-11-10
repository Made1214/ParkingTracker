import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth";

const cents = (value: number | null) => Math.round(Number(value ?? 0) * 100);
const monthKey = (value: string | number) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Panama",
  }).format(new Date(value));

/** Historial y estadísticas del grupo, agregadas en el servidor (RF-1000). */
export async function getGroupStats(groupId: string) {
  const { supabase, user } = await requireUser(`/groups/${groupId}/stats`);
  if (!z.guid().safeParse(groupId).success) notFound();
  const [group, events, participation, spending, going, photos, usage] =
    await Promise.all([
      supabase.from("groups").select("name").eq("id", groupId).maybeSingle(),
      supabase
        .from("events")
        .select("id, title, location, starts_at, ends_at, status")
        .eq("group_id", groupId)
        .in("status", ["published", "finished"])
        .order("starts_at", { ascending: false }),
      supabase
        .from("member_participation")
        .select("user_id, display_name, events_attended, events_invited")
        .eq("group_id", groupId),
      supabase
        .from("event_expense_summary")
        .select("event_id, total_amount")
        .eq("group_id", groupId),
      supabase
        .from("event_attendance")
        .select("event_id")
        .eq("group_id", groupId)
        .eq("status", "going"),
      supabase.from("photos").select("event_id").eq("group_id", groupId),
      supabase
        .from("group_storage_usage")
        .select("bytes_used, bytes_quota")
        .eq("group_id", groupId)
        .maybeSingle(),
    ]);
  if (
    group.error ||
    events.error ||
    participation.error ||
    spending.error ||
    going.error ||
    photos.error ||
    usage.error
  )
    throw new Error("No se pudieron cargar las estadísticas.");
  if (!group.data) notFound();

  const now = Date.now();
  const count = (rows: { event_id: string }[], id: string) =>
    rows.filter((row) => row.event_id === id).length;
  const members = participation.data.length;
  const history = events.data
    .filter(
      (event) =>
        event.status === "finished" || Date.parse(event.ends_at) <= now,
    )
    .map((event) => ({
      id: event.id,
      title: event.title,
      location: event.location,
      startsAt: event.starts_at,
      going: count(going.data, event.id),
      photos: count(photos.data, event.id),
      cents: cents(
        spending.data.find((row) => row.event_id === event.id)?.total_amount ??
          0,
      ),
    }));

  // Últimos seis meses, incluido el actual (con las salidas por venir).
  const current = monthKey(now);
  const months = Array.from({ length: 6 }, (_, index) => {
    const [year, month] = current.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1 - (5 - index), 15));
    const key = monthKey(date.getTime());
    return {
      key,
      label: new Intl.DateTimeFormat("es-PA", {
        month: "short",
        timeZone: "UTC",
      })
        .format(date)
        .replace(".", ""),
      total: events.data.filter((event) => monthKey(event.starts_at) === key)
        .length,
      current: key === current,
    };
  });

  const totalCents = history.reduce((sum, event) => sum + event.cents, 0);
  return {
    groupName: group.data.name,
    members,
    history,
    months,
    ranking: participation.data
      .map((row) => ({
        id: row.user_id,
        name: row.user_id === user.id ? "Tú" : row.display_name,
        initialsOf: row.display_name,
        attended: Number(row.events_attended ?? 0),
        invited: Number(row.events_invited ?? 0),
      }))
      .sort((a, b) => b.attended - a.attended || a.name.localeCompare(b.name)),
    averageAttendance:
      history.length && members
        ? Math.round(
            (history.reduce((sum, event) => sum + event.going, 0) /
              (history.length * members)) *
              100,
          )
        : null,
    totalCents,
    averageCents: history.length ? Math.round(totalCents / history.length) : 0,
    photoCount: photos.data.length,
    usedBytes: usage.data?.bytes_used ?? 0,
    quotaBytes: usage.data?.bytes_quota ?? 104857600,
  };
}
