import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { EventList, CreateEventForm } from "@/features/events";
import { publicEnv } from "@/shared/lib/env";
import { getGroup } from "../api/queries";
import { InviteCard } from "./invite-card";
import { GroupImage } from "./group-image";
export async function GroupScreen({ groupId }: { groupId: string }) {
  const { group, members } = await getGroup(groupId);
  return (
    <>
      <Link className="back-link" href="/groups">
        <ArrowLeft size={16} /> Mis grupos
      </Link>
      <div className="page-heading group-header">
        <div>
          <span className="eyebrow">
            <Users size={13} /> GRUPO PRIVADO · {members.length}{" "}
            {members.length === 1 ? "MIEMBRO" : "MIEMBROS"}
          </span>
          <h1>{group.name}</h1>
          {group.avatar_public_id && (
            <GroupImage
              key={group.updated_at}
              groupId={groupId}
              revision={group.updated_at}
            />
          )}
          {group.description && (
            <p className="description">{group.description}</p>
          )}
          <p className="muted">
            {members.length} {members.length === 1 ? "persona" : "personas"} ·
            Un montón de planes por hacer.
          </p>
        </div>
        <div className="member-roster" aria-label="Miembros">
          <div className="avatar-stack">
            {members.slice(0, 6).map((member) => (
              <span
                title={member.profiles?.display_name ?? "Miembro"}
                key={member.user_id}
              >
                {(member.profiles?.display_name ?? "?")
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
            ))}
          </div>
          <div className="member-names">
            <span className="small muted">En este grupo</span>
            <strong>
              {members
                .slice(0, 3)
                .map((m) => m.profiles?.display_name ?? "Miembro")
                .join(", ")}
              {members.length > 3 ? ` +${members.length - 3}` : ""}
            </strong>
          </div>
        </div>
      </div>
      <InviteCard code={group.invite_code} appUrl={publicEnv().appUrl} />
      <p>
        <Link href={`/groups/${groupId}/settings`}>
          Miembros y ajustes del grupo
        </Link>
      </p>
      <div className="content-columns">
        <section className="events-column">
          <div className="section-heading">
            <h2>Los planes del grupo</h2>
            <span className="small muted">Ordenados por fecha</span>
          </div>
          <EventList groupId={groupId} />
        </section>
        <aside className="sticky-aside">
          <CreateEventForm groupId={groupId} />
        </aside>
      </div>
    </>
  );
}
