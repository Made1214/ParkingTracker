import { requireUser } from "@/features/auth";
import { Card } from "@/shared/ui/card";
import { ActionForm } from "@/shared/ui/action-form";
import { Input } from "@/shared/ui/input";
import { joinGroup } from "../api/actions";
export async function JoinScreen({ code }: { code: string }) {
  await requireUser(`/join/${code}`);
  return (
    <Card className="join-card">
      <span className="eyebrow">TE ESTÁN ESPERANDO</span>
      <h1>Súmate al plan.</h1>
      <p className="muted">
        Confirma el código para entrar al grupo y ver lo que están preparando.
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
