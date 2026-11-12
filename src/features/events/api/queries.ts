import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth";
export async function listEvents(groupId: string) {
  const { supabase } = await requireUser(`/groups/${groupId}`);
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("group_id", groupId)
    .order("starts_at");
  if (error) throw new Error("No se pudieron cargar los eventos.");
  return data.map(withEffectiveStatus);
}
export const EVENT_PAGE_SIZE = 20;
export type EventTab = "proximas" | "pasadas";

/** `?salidas=` → pestaña; cualquier otro valor cae en Próximas. */
export function eventTab(value?: string | string[]): EventTab {
  return (Array.isArray(value) ? value[0] : value) === "pasadas"
    ? "pasadas"
    : "proximas";
}

/**
 * Una página de salidas del grupo (plan E4.F2.T1), paginada por cursor.
 *
 * - Próximas: borradores y publicadas que aún no terminan, de la más
 *   cercana a la más lejana.
 * - Pasadas: finalizadas, canceladas y publicadas ya terminadas (el cron
 *   puede no haberlas cerrado aún), de la más reciente a la más antigua.
 *
 * El cursor es el id de la última salida mostrada; su `starts_at` se lee
 * con RLS, así que un id de otro grupo simplemente no encuentra nada.
 */
export async function listEventPage(
  groupId: string,
  tab: EventTab,
  cursor?: string,
) {
  const { supabase } = await requireUser(`/groups/${groupId}`);
  const now = new Date().toISOString();
  let after: { id: string; starts_at: string } | null = null;
  if (cursor && z.guid().safeParse(cursor).success) {
    const { data } = await supabase
      .from("events")
      .select("id, starts_at")
      .eq("group_id", groupId)
      .eq("id", cursor)
      .maybeSingle();
    after = data;
  }
  const upcoming = tab === "proximas";
  let query = supabase
    .from("events")
    .select("*")
    .eq("group_id", groupId)
    .or(
      upcoming
        ? `status.eq.draft,and(status.eq.published,ends_at.gt."${now}")`
        : `status.in.(finished,cancelled),and(status.eq.published,ends_at.lte."${now}")`,
    );
  if (after) {
    const op = upcoming ? "gt" : "lt";
    query = query.or(
      `starts_at.${op}."${after.starts_at}",and(starts_at.eq."${after.starts_at}",id.${op}.${after.id})`,
    );
  }
  const { data, error } = await query
    .order("starts_at", { ascending: upcoming })
    .order("id", { ascending: upcoming })
    .limit(EVENT_PAGE_SIZE + 1);
  if (error) throw new Error("No se pudieron cargar los eventos.");
  const events = data.slice(0, EVENT_PAGE_SIZE).map(withEffectiveStatus);
  return {
    events,
    nextCursor:
      data.length > EVENT_PAGE_SIZE ? (events.at(-1)?.id ?? null) : null,
    isFirstPage: !after,
  };
}

export async function getEvent(groupId: string, eventId: string) {
  const { supabase, user } = await requireUser(
    `/groups/${groupId}/events/${eventId}`,
  );
  if (
    !z.guid().safeParse(groupId).success ||
    !z.guid().safeParse(eventId).success
  )
    notFound();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el evento.");
  if (!data) notFound();
  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError)
    throw new Error("No se pudieron comprobar los permisos del evento.");
  const organizer =
    data.created_by && data.created_by !== user.id
      ? ((
          await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", data.created_by)
            .maybeSingle()
        ).data?.display_name ?? null)
      : data.created_by
        ? "Tú"
        : null;
  return {
    event: withEffectiveStatus(data),
    organizer,
    user,
    canManage:
      (data.created_by === user.id || membership?.role === "admin") &&
      (data.status === "draft" ||
        (data.status === "published" &&
          Date.parse(data.starts_at) > Date.now())),
    canRespond:
      data.status === "published" && Date.parse(data.starts_at) > Date.now(),
  };
}

function withEffectiveStatus<
  T extends {
    status: "draft" | "published" | "cancelled" | "finished";
    ends_at: string;
  },
>(event: T): T {
  return event.status === "published" && Date.parse(event.ends_at) <= Date.now()
    ? { ...event, status: "finished" }
    : event;
}
