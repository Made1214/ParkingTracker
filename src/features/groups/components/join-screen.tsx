import Link from "next/link";
import { Users } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { ActionForm } from "@/shared/ui/action-form";
import { Input } from "@/shared/ui/input";
import { joinGroup } from "../api/actions";
import { getInvitePreview } from "../api/queries";

export async function JoinScreen({ code }: { code: string }) {
  const preview = await getInvitePreview(code);

  if (preview?.alreadyMember)
    return (
      <Card className="join-card">
        <span className="eyebrow">YA ESTÁS DENTRO</span>
        <h1>Ya eres parte de {preview.name}.</h1>
        <p className="muted">
          No hace falta volver a unirte: el grupo te está esperando.
        </p>
        <Link className="button" href={`/groups/${preview.groupId}`}>
          Ir al grupo
        </Link>
      </Card>
    );

  if (preview)
    return (
      <Card className="join-card">
        <span className="eyebrow">TE ESTÁN ESPERANDO</span>
        <div className="join-group">
          <span className="join-group-avatar" aria-hidden="true">
            {preview.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h1>{preview.name}</h1>
            <p className="small muted join-group-size">
              <Users size={14} aria-hidden="true" /> {preview.memberCount}{" "}
              {preview.memberCount === 1 ? "miembro" : "miembros"}
            </p>
          </div>
        </div>
        {preview.description && <p>{preview.description}</p>}
        <p className="muted">
          Al unirte verás sus salidas, votaciones, gastos y fotos.
        </p>
        <ActionForm action={joinGroup} label={`Unirme a ${preview.name}`}>
          <input type="hidden" name="code" value={preview.code} />
        </ActionForm>
      </Card>
    );

  return (
    <Card className="join-card">
      <span className="eyebrow">TE ESTÁN ESPERANDO</span>
      <h1>Súmate al plan.</h1>
      <p className="muted">
        {code
          ? "No encontramos un grupo con ese enlace. Revisa el código que te enviaron."
          : "Escribe el código de invitación que te enviaron."}
      </p>
      <ActionForm action={joinGroup} label="Aceptar invitación">
        <label>
          Código de invitación
          <Input
            name="code"
            defaultValue={code.toUpperCase()}
            pattern="[A-Za-z0-9]{8}"
            minLength={8}
            maxLength={8}
            required
          />
        </label>
      </ActionForm>
    </Card>
  );
}
