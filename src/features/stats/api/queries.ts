import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth";

const statsPayload = z.object({
  groupName: z.string(),
  members: z.number(),
  history: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      location: z.string().nullable(),
      startsAt: z.string(),
      going: z.number(),
      photos: z.number(),
      cents: z.number(),
    }),
  ),
  ranking: z.array(
    z.object({
      user_id: z.string(),
      display_name: z.string(),
      events_attended: z.number(),
      events_invited: z.number(),
    }),
  ),
  months: z.record(z.string(), z.number()),
  averageAttendance: z.number().nullable(),
  totalCents: z.number(),
  averageCents: z.number(),
  photoCount: z.number(),
  usedBytes: z.number(),
  quotaBytes: z.number(),
});

/** Carga los agregados de Postgres y presenta nombres y meses en el idioma de la app. */
export async function getGroupStats(groupId: string) {
  const { supabase, user } = await requireUser(`/groups/${groupId}/stats`);
  if (!z.guid().safeParse(groupId).success) notFound();
  const { data, error } = await supabase.rpc("get_group_stats", {
    p_group_id: groupId,
  });
  if (error) throw new Error("No se pudieron cargar las estadísticas.");
  if (!data) notFound();
  const { months: monthCounts, ranking, ...stats } = statsPayload.parse(data);

  const current = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Panama",
  }).format(new Date());
  const [year, month] = current.split("-").map(Number);
  const formatMonth = new Intl.DateTimeFormat("es-PA", {
    month: "short",
    timeZone: "UTC",
  });
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (5 - index), 15));
    const key = date.toISOString().slice(0, 7);
    return {
      key,
      label: formatMonth.format(date).replace(".", ""),
      total: monthCounts[key] ?? 0,
      current: key === current,
    };
  });

  return {
    ...stats,
    months,
    ranking: ranking
      .map((row) => ({
        id: row.user_id,
        name: row.user_id === user.id ? "Tú" : row.display_name,
        initialsOf: row.display_name,
        attended: row.events_attended,
        invited: row.events_invited,
      }))
      .sort((a, b) => b.attended - a.attended || a.name.localeCompare(b.name)),
  };
}
