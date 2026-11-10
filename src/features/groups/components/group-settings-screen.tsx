import Link from "next/link";
import { ArrowLeft, ImagePlus, LogOut, RefreshCw, UserCog } from "lucide-react";
import { getGroup } from "../api/queries";
import {
  leaveGroup,
  manageMember,
  regenerateInvite,
  updateGroupAvatar,
} from "../api/manage-actions";
import { publicEnv } from "@/shared/lib/env";
import { initials } from "@/shared/lib/utils";
import { ActionForm } from "@/shared/ui/action-form";
import { Disclosure } from "@/shared/ui/disclosure";
import { Input } from "@/shared/ui/input";
import { GroupDetailsForm } from "./group-details-form";
import { InviteCode } from "./invite-code";
import styles from "./group-settings.module.css";

export async function GroupSettingsScreen({ groupId }: { groupId: string }) {
  const { group, members, user } = await getGroup(groupId);
  const isAdmin = members.some(
    (m) => m.user_id === user.id && m.role === "admin",
  );
  const ids = <input type="hidden" name="group_id" value={groupId} />;
  const sorted = [...members].sort((a, b) =>
    a.role === b.role
      ? (a.profiles?.display_name ?? "").localeCompare(
          b.profiles?.display_name ?? "",
        )
      : a.role === "admin"
        ? -1
        : 1,
  );
  return (
    <>
      <header className={styles.header}>
        <Link className={styles.back} href={`/groups/${groupId}`}>
          <ArrowLeft size={16} aria-hidden="true" /> Volver al grupo
        </Link>
        <span className="eyebrow">AJUSTES DEL GRUPO</span>
        <h1>{group.name}</h1>
        <p className="muted">
          {isAdmin
            ? "Administras este grupo: puedes cambiar roles, la imagen y la invitación."
            : "Aquí ves a tu gente y puedes compartir la invitación."}
        </p>
      </header>
      <div className={styles.layout}>
        <section className="card" aria-labelledby="group-members-title">
          <div className={styles.cardHead}>
            <h2 id="group-members-title">Tu gente</h2>
            <span className="count">{members.length}</span>
          </div>
          <ul className={styles.members}>
            {sorted.map((member) => {
              const name = member.profiles?.display_name ?? "Miembro";
              const me = member.user_id === user.id;
              return (
                <li key={member.user_id}>
                  <div className={styles.memberHeading}>
                    <span
                      className={styles.avatar}
                      data-me={me || undefined}
                      aria-hidden="true"
                    >
                      {initials(name)}
                    </span>
                    <strong>
                      {name}
                      {me && <small> · tú</small>}
                    </strong>
                    <span
                      className={styles.role}
                      data-admin={member.role === "admin" || undefined}
                    >
                      {member.role === "admin" ? "Admin" : "Miembro"}
                    </span>
                  </div>
                  {isAdmin && (
                    <Disclosure
                      compact
                      className={styles.manage}
                      icon={<UserCog size={16} />}
                      title={`Gestionar a ${me ? "ti" : name.split(" ")[0]}`}
                    >
                      <ActionForm action={manageMember} label="Guardar rol">
                        {ids}
                        <input
                          type="hidden"
                          name="user_id"
                          value={member.user_id}
                        />
                        <label>
                          Rol
                          <select
                            className="input"
                            name="operation"
                            defaultValue={member.role}
                          >
                            <option value="member">Miembro</option>
                            <option value="admin">Administrador</option>
                          </select>
                        </label>
                      </ActionForm>
                      {!me && (
                        <ActionForm
                          action={manageMember}
                          label="Quitar del grupo"
                          tone="danger"
                        >
                          {ids}
                          <input
                            type="hidden"
                            name="user_id"
                            value={member.user_id}
                          />
                          <input
                            type="hidden"
                            name="operation"
                            value="remove"
                          />
                          <p className="small muted">
                            Perderá el acceso al contenido del grupo.
                          </p>
                        </ActionForm>
                      )}
                    </Disclosure>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <div className={styles.side}>
          <section className="card" aria-labelledby="invite-title">
            <div className={styles.cardHead}>
              <h2 id="invite-title">Invitación</h2>
            </div>
            <p className="small muted">
              Comparte el código o copia el enlace para sumar a alguien.
            </p>
            <InviteCode
              code={group.invite_code}
              appUrl={publicEnv().appUrl}
              light
            />
            {isAdmin && (
              <Disclosure
                compact
                className={styles.spaced}
                icon={<RefreshCw size={16} />}
                title="Renovar la invitación"
                hint="El código y enlace anteriores dejarán de funcionar"
              >
                <ActionForm
                  action={regenerateInvite}
                  label="Confirmar nueva invitación"
                >
                  {ids}
                </ActionForm>
              </Disclosure>
            )}
          </section>

          {isAdmin && (
            <section className="card" aria-labelledby="details-title">
              <div className={styles.cardHead}>
                <h2 id="details-title">Información del grupo</h2>
              </div>
              <GroupDetailsForm group={group} />
              <Disclosure
                compact
                className={styles.spaced}
                icon={<ImagePlus size={16} />}
                title="Imagen del grupo"
                hint="JPG, PNG o WebP de hasta 5 MB, solo para miembros"
              >
                <ActionForm action={updateGroupAvatar} label="Guardar imagen">
                  {ids}
                  <label>
                    Elegir imagen
                    <Input
                      type="file"
                      name="avatar"
                      accept="image/jpeg,image/png,image/webp"
                      required
                    />
                  </label>
                </ActionForm>
                {group.avatar_public_id && (
                  <ActionForm
                    action={updateGroupAvatar}
                    label="Eliminar imagen"
                    tone="danger"
                  >
                    {ids}
                    <input type="hidden" name="remove" value="true" />
                  </ActionForm>
                )}
              </Disclosure>
            </section>
          )}

          <Disclosure
            tone="danger"
            icon={<LogOut size={18} />}
            title="Salir del grupo"
            hint="Perderás acceso a sus planes y recuerdos"
          >
            <p className="small muted">
              Si eres la única persona admin, nombra antes a otra.
            </p>
            <ActionForm
              action={leaveGroup}
              label="Confirmar salida"
              tone="danger"
            >
              {ids}
            </ActionForm>
          </Disclosure>
        </div>
      </div>
    </>
  );
}
