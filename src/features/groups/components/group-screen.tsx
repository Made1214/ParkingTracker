import Link from "next/link";
import { ArrowLeft, Settings2, TrendingUp } from "lucide-react";
import { EventList, CreateEventForm, listEvents } from "@/features/events";
import { publicEnv } from "@/shared/lib/env";
import { initials } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import { getGroup } from "../api/queries";
import { InviteCode } from "./invite-code";
import { GroupImage } from "./group-image";
import styles from "./group.module.css";

export async function GroupScreen({ groupId }: { groupId: string }) {
  const [{ group, members, user }, events] = await Promise.all([
    getGroup(groupId),
    listEvents(groupId),
  ]);
  const name = (member: (typeof members)[number]) =>
    member.user_id === user.id
      ? "Tú"
      : (member.profiles?.display_name ?? "Miembro");
  const admins = members.filter((member) => member.role === "admin");
  const sortedMembers = [...members].sort((a, b) =>
    a.user_id === user.id
      ? 1
      : b.user_id === user.id
        ? -1
        : a.role === b.role
          ? name(a).localeCompare(name(b))
          : a.role === "admin"
            ? -1
            : 1,
  );
  const since = new Intl.DateTimeFormat("es-PA", {
    month: "long",
    year: "numeric",
    timeZone: "America/Panama",
  }).format(new Date(group.created_at));
  const finished = events.filter((e) => e.status === "finished").length;
  const upcoming = events.filter((e) => e.status === "published").length;
  const drafts = events.filter((e) => e.status === "draft").length;

  return (
    <>
      <header className={styles.hero}>
        <Link className={styles.back} href="/groups">
          <ArrowLeft size={16} aria-hidden="true" /> Inicio
        </Link>
        <div className={styles.heroBody}>
          <span className={styles.avatar}>
            {group.avatar_public_id ? (
              <GroupImage
                key={group.updated_at}
                groupId={groupId}
                revision={group.updated_at}
              />
            ) : (
              <span aria-hidden="true">
                {group.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
          <div className={styles.title}>
            <h1>{group.name}</h1>
            <p>
              {members.length} {members.length === 1 ? "miembro" : "miembros"}
              {admins.length > 0 &&
                ` · admin: ${admins.map(name).slice(0, 2).join(", ")}`}
              {` · desde ${since}`}
            </p>
            {group.description && (
              <p className={styles.description}>{group.description}</p>
            )}
          </div>
          <InviteCode code={group.invite_code} appUrl={publicEnv().appUrl} />
        </div>
      </header>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className="eyebrow">SALIDAS</span>
          <strong>{finished}</strong>
          <span className="small muted">ya vividas</span>
        </div>
        <div className={styles.kpi}>
          <span className="eyebrow">PRÓXIMAS</span>
          <strong>{upcoming}</strong>
          <span className="small muted">publicadas en el calendario</span>
        </div>
        <div className={styles.kpi}>
          <span className="eyebrow">BORRADORES</span>
          <strong>{drafts}</strong>
          <span className="small muted">ideas por confirmar</span>
        </div>
        <div className={styles.kpi}>
          <span className="eyebrow">MIEMBROS</span>
          <strong>{members.length}</strong>
          <span className="small muted">
            {admins.length} {admins.length === 1 ? "admin" : "admins"}
          </span>
        </div>
      </div>

      <Link href={`/groups/${groupId}/stats`} className={styles.statsLink}>
        <TrendingUp size={16} aria-hidden="true" /> Ver historial y estadísticas
        del grupo
      </Link>

      <div className={styles.columns}>
        <section className={styles.events} aria-labelledby="group-events">
          <div className={styles.sectionHead}>
            <h2 id="group-events">Salidas</h2>
            <span className="small muted">Próximas primero</span>
          </div>
          <EventList groupId={groupId} events={events} />
          <Card className={styles.members}>
            <div className={styles.sectionHead}>
              <h2>Miembros</h2>
              <span className="count">{members.length}</span>
            </div>
            <ul>
              {sortedMembers.slice(0, 8).map((member) => (
                <li key={member.user_id}>
                  <span
                    className={styles.memberAvatar}
                    data-me={member.user_id === user.id || undefined}
                    aria-hidden="true"
                  >
                    {initials(member.profiles?.display_name ?? "?")}
                  </span>
                  <strong>{name(member)}</strong>
                  {member.role === "admin" ? (
                    <span className={styles.admin}>ADMIN</span>
                  ) : (
                    <span className="small muted">Miembro</span>
                  )}
                </li>
              ))}
            </ul>
            {members.length > 8 && (
              <p className="small muted">
                y {members.length - 8} más en los ajustes del grupo.
              </p>
            )}
            <Link
              href={`/groups/${groupId}/settings`}
              className={styles.settingsLink}
            >
              <Settings2 size={16} aria-hidden="true" /> Miembros y ajustes del
              grupo
            </Link>
          </Card>
        </section>
        <aside className={styles.side}>
          <div id="nueva-salida" className={styles.anchor}>
            <CreateEventForm groupId={groupId} />
          </div>
        </aside>
      </div>
    </>
  );
}
