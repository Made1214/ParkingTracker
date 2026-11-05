import Link from "next/link";
import { ArrowUpRight, Users, Plus, Ticket } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ActionForm } from "@/shared/ui/action-form";
import { listGroups } from "../api/queries";
import { createGroup, joinGroup } from "../api/actions";
export async function GroupsScreen() {
  const { groups, user } = await listGroups();
  const name = String(user.user_metadata.full_name ?? "").split(" ")[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TU PUNTO DE ENCUENTRO</span>
          <h1>
            {name ? `Hola, ${name}.` : "Tu gente, tus planes."}
            <br />
            <span className="muted-heading">¿Qué se arma?</span>
          </h1>
          <p className="muted">
            Elige un grupo y empieza a hacer espacio para el próximo recuerdo.
          </p>
        </div>
        <span className="hero-mark" aria-hidden="true">
          ↗
        </span>
      </div>
      <div className="section-heading">
        <h2>
          Mis grupos <span className="count">{groups.length}</span>
        </h2>
        <span className="small muted">Todo empieza con tu gente</span>
      </div>
      {groups.length ? (
        <div className="group-grid">
          {groups.map((group, i) => (
            <Link
              className="group-card"
              href={`/groups/${group.id}`}
              key={group.id}
            >
              <div className={`group-art art-${i % 3}`}>
                <Users size={38} strokeWidth={1.3} />
                <span className="group-initial">{group.name.slice(0, 1)}</span>
              </div>
              <div className="group-card-body">
                <h3>{group.name}</h3>
                <span className="small muted">Ver planes del grupo</span>
                <ArrowUpRight size={22} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="empty-state">
          <Users size={32} />
          <h3>Aquí irá tu próxima gran historia.</h3>
          <p className="muted">
            Crea un grupo o únete con el código que te compartieron.
          </p>
        </Card>
      )}
      <div className="two-column setup-grid">
        <Card>
          <span className="tile-icon">
            <Plus size={20} />
          </span>
          <h2>Reúne a tu gente</h2>
          <p className="muted">
            Crea un espacio privado para los planes de siempre y los que aún no
            imaginan.
          </p>
          <ActionForm action={createGroup} label="Crear grupo">
            <label>
              Nombre del grupo
              <Input
                name="name"
                required
                maxLength={80}
                placeholder="Los de siempre"
              />
            </label>
          </ActionForm>
        </Card>
        <Card>
          <span className="tile-icon peach">
            <Ticket size={20} />
          </span>
          <h2>¿Ya tienes invitación?</h2>
          <p className="muted">
            Tu grupo te está esperando. Introduce el código y súmate al próximo
            plan.
          </p>
          <ActionForm action={joinGroup} label="Unirme al grupo">
            <label>
              Código de invitación
              <Input
                name="code"
                required
                minLength={8}
                maxLength={8}
                pattern="[A-Za-z0-9]{8}"
                placeholder="ABCD1234"
                autoCapitalize="characters"
              />
            </label>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
