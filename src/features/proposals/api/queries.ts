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

export async function getPolls(groupId: string, eventId: string) {
  const { supabase, user } = await requireUser();
  const [
    { data, error },
    { data: member, error: memberError },
    { data: event, error: eventError },
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
  ]);
  if (error || memberError || eventError || !event)
    throw new Error("No se pudieron cargar las votaciones.");
  const results = await Promise.all(
    data.map(async (poll) => {
      const { data: counts, error: countsError } = await supabase.rpc(
        "get_poll_results",
        { p_poll_id: poll.id },
      );
      if (countsError) throw new Error("No se pudieron cargar los resultados.");
      return { ...poll, results: counts };
    }),
  );
  const isAdmin = member?.role === "admin";
  const canSchedule =
    event.status === "published" && (isAdmin || event.created_by === user.id);
  return {
    polls: results,
    userId: user.id,
    isAdmin,
    canSchedule,
    eventStartsAt: panamaInput(event.starts_at),
    eventEndsAt: panamaInput(event.ends_at),
    now: Date.now(),
  };
}

/** La votación abierta más reciente con sus porcentajes, para el plan. */
export async function getLivePoll(groupId: string, eventId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("polls")
    .select("id, question, closes_at, poll_options(id, label, position)")
    .eq("group_id", groupId)
    .eq("event_id", eventId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar las votaciones.");
  const now = Date.now();
  const poll = data.find(
    (item) => !item.closes_at || Date.parse(item.closes_at) > now,
  );
  if (!poll) return { poll: null, openCount: 0 };
  const { data: results, error: resultsError } = await supabase.rpc(
    "get_poll_results",
    { p_poll_id: poll.id },
  );
  if (resultsError) throw new Error("No se pudieron cargar los resultados.");
  const total = results.reduce((sum, row) => sum + Number(row.votes), 0);
  return {
    openCount: data.filter(
      (item) => !item.closes_at || Date.parse(item.closes_at) > now,
    ).length,
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
