import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { publicEnv } from "@/shared/lib/env";
import { getGroup } from "../api/queries";
import { InviteCard } from "./invite-card";
export async function GroupScreen({ groupId }: { groupId: string }) {
  const { group, members } = await getGroup(groupId);
  return (
    <>
      <Link className="back-link" href="/groups">
        <ArrowLeft size={16} /> Mis grupos
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ESTE ES SU ESPACIO</span>
          <h1>{group.name}</h1>
          <p className="muted">
            {members.length} {members.length === 1 ? "persona" : "personas"} ·
            Un montón de planes por hacer.
          </p>
        </div>
        <div className="avatar-stack" aria-label="Miembros">
          {members.slice(0, 6).map((member) => (
            <span title={member.profiles?.display_name} key={member.user_id}>
              {member.profiles?.display_name?.slice(0, 1) ?? "?"}
            </span>
          ))}
        </div>
      </div>
      <InviteCard code={group.invite_code} appUrl={publicEnv().appUrl} />
    </>
  );
}
