import "server-only";
import { requireUser } from "@/features/auth";
import { panamaInput } from "@/shared/lib/utils";

export async function getProposals(groupId: string, eventId: string) {
  const { supabase, user } = await requireUser(
    `/groups/${groupId}/events/${eventId}`,
  );
  const { data, error } = await supabase
    .from("activity_proposals")
    .select(
      "id, title, description, status, created_at, profiles(display_name)",
    )
    .eq("group_id", groupId)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar las propuestas.");
  const [event, member] = await Promise.all([
    supabase
      .from("events")
      .select("created_by")
      .eq("id", eventId)
      .eq("group_id", groupId)
      .maybeSingle(),
    supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (event.error || member.error)
    throw new Error("No se pudieron comprobar los permisos de propuestas.");
  return {
    proposals: data,
    canReview:
      event.data?.created_by === user.id || member.data?.role === "admin",
  };
}

// Carga las votaciones y sus resultados en bloque para una salida.
export async function getPolls(groupId: string, eventId: string) {
  const { supabase, user } = await requireUser();
  const [
    { data, error },
    { data: member, error: memberError },
    { data: event, error: eventError },
    { data: counts, error: countsError },
  ] = await Promise.all([
    supabase
      .from("polls")
      .select(
        "*, poll_options(id,label,position), poll_votes(option_id,user_id)",
      )
      .eq("group_id", groupId)
      .eq("poll_votes.user_id", user.id)
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("events")
      .select("starts_at, ends_at, created_by, status")
      .eq("id", eventId)
      .eq("group_id", groupId)
      .maybeSingle(),
    supabase.rpc("get_event_poll_results", { p_event_id: eventId }),
  ]);
  if (error || memberError || eventError || !event)
    throw new Error("No se pudieron cargar las votaciones.");
  if (countsError) throw new Error("No se pudieron cargar los resultados.");
  const byPoll = new Map<string, typeof counts>();
  for (const result of counts) {
    const options = byPoll.get(result.poll_id) ?? [];
    options.push(result);
    byPoll.set(result.poll_id, options);
  }
  const now = Date.now();
  const isAdmin = member?.role === "admin";
  const eventEndsTime = Date.parse(event.ends_at);
  const canSchedule =
    event.status === "published" &&
    eventEndsTime > now &&
    (isAdmin || event.created_by === user.id);
  return {
    polls: data.map((poll) => ({
      ...poll,
      results: byPoll.get(poll.id) ?? [],
    })),
    userId: user.id,
    isAdmin,
    canSchedule,
    eventEndsTime,
    eventStartsAt: panamaInput(event.starts_at),
    eventEndsAt: panamaInput(event.ends_at),
    now,
  };
}

/** La votación abierta más reciente con sus porcentajes, para el plan. */
export async function getLivePoll(groupId: string, eventId: string) {
  const { supabase } = await requireUser();
  const now = new Date();
  const { data, error } = await supabase
    .from("polls")
    .select(
      "id, question, closes_at, poll_options(id, label, position), events!inner(status, ends_at)",
    )
    .eq("group_id", groupId)
    .eq("event_id", eventId)
    .eq("status", "open")
    .eq("events.status", "published")
    .gt("events.ends_at", now.toISOString())
    .or(`closes_at.is.null,closes_at.gt."${now.toISOString()}"`)
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar las votaciones.");
  const poll = data[0];
  if (!poll) return { poll: null, openCount: 0 };
  const { data: results, error: resultsError } = await supabase.rpc(
    "get_poll_results",
    { p_poll_id: poll.id },
  );
  if (resultsError) throw new Error("No se pudieron cargar los resultados.");
  const total = results.reduce((sum, row) => sum + Number(row.votes), 0);
  return {
    openCount: data.length,
    poll: {
      id: poll.id,
      question: poll.question,
      options: [...poll.poll_options]
        .sort((a, b) => a.position - b.position)
        .map((option) => {
          const votes = Number(
            results.find((row) => row.option_id === option.id)?.votes ?? 0,
          );
          return {
            id: option.id,
            label: option.label,
            percent: total ? Math.round((votes / total) * 100) : 0,
          };
        })
        .sort((a, b) => b.percent - a.percent),
    },
  };
}
