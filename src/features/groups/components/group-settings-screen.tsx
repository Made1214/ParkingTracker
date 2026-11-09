import Link from "next/link";
import { getGroup } from "../api/queries";
import {
  leaveGroup,
  manageMember,
  regenerateInvite,
  updateGroupAvatar,
} from "../api/manage-actions";
import { ActionForm } from "@/shared/ui/action-form";
import { Input } from "@/shared/ui/input";
import { GroupDetailsForm } from "./group-details-form";
import styles from "./group-settings.module.css";

export async function GroupSettingsScreen({ groupId }: { groupId: string }) {
  const { group, members, user } = await getGroup(groupId);
  const isAdmin = members.some(
    (m) => m.user_id === user.id && m.role === "admin",
  );
  const ids = <input type="hidden" name="group_id" value={groupId} />;
  return (
    <>
      <Link className="back-link" href={`/groups/${groupId}`}>
        Volver al grupo
      </Link>
      <div className="page-heading">
        <div>
          <h1>Miembros y ajustes</h1>
          <p className="muted">{group.name}</p>
        </div>
      </div>
      <div className={styles.layout}>
        <section
          className="card form-stack"
          aria-labelledby="group-members-title"
        >
          <h2 id="group-members-title">Tu gente · {members.length}</h2>
          <ul className={styles.members}>
            {members.map((member) => (
              <li key={member.user_id}>
                <div className={styles.memberHeading}>
                  <strong>
                    {member.profiles?.display_name ?? "Miembro"}
                    {member.user_id === user.id ? " (tú)" : ""}
                  </strong>
                  <span className="badge">
                    {member.role === "admin" ? "Administrador" : "Miembro"}
                  </span>
                </div>
                {isAdmin && (
                  <details>
                    <summary>
                      Gestionar a{" "}
                      {member.profiles?.display_name ?? "este miembro"}
                    </summary>
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
                    {member.user_id !== user.id && (
                      <details>
                        <summary>Quitar del grupo</summary>
                        <p className="small muted">
                          Esta persona perderá el acceso al contenido del grupo.
                        </p>
                        <ActionForm
                          action={manageMember}
                          label="Confirmar expulsión"
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
                        </ActionForm>
                      </details>
                    )}
                  </details>
                )}
              </li>
            ))}
          </ul>
          <details>
            <summary>Salir del grupo</summary>
            <p className="small muted">
              Perderás acceso a los planes y recuerdos del grupo. El último
              administrador debe nombrar antes a otra persona.
            </p>
            <ActionForm action={leaveGroup} label="Confirmar salida">
              {ids}
            </ActionForm>
          </details>
        </section>
        {isAdmin && (
          <div className="form-stack">
            <section className="card form-stack">
              <h2>Información del grupo</h2>
              <GroupDetailsForm group={group} />
            </section>
            <section className="card form-stack">
              <h2>Imagen del grupo</h2>
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
                <p className="small muted">
                  JPG, PNG o WebP. Máximo 5 MB. Solo visible para miembros.
                </p>
              </ActionForm>
              {group.avatar_public_id && (
                <ActionForm action={updateGroupAvatar} label="Eliminar imagen">
                  {ids}
                  <input type="hidden" name="remove" value="true" />
                </ActionForm>
              )}
            </section>
            <section className="card form-stack">
              <h2>Invitación</h2>
              <p className="small muted">
                Código actual: <strong>{group.invite_code}</strong>
              </p>
              <details>
                <summary>Renovar la invitación</summary>
                <p className="small muted">
                  El enlace y el código anteriores dejarán de funcionar. Las
                  personas que ya pertenecen al grupo seguirán dentro.
                </p>
                <ActionForm
                  action={regenerateInvite}
                  label="Confirmar nueva invitación"
                >
                  {ids}
                </ActionForm>
              </details>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
