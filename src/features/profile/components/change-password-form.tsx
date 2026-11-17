"use client";

import { KeyRound } from "lucide-react";
import { ActionForm } from "@/shared/ui/action-form";
import { Disclosure } from "@/shared/ui/disclosure";
import { PasswordInput } from "@/shared/ui/password-input";
import { changePassword } from "../api/password-actions";

/**
 * Cambiar la contraseña con la sesión iniciada; pide la actual. La regla de
 * contraseñas llega por props: este componente no puede importar `auth`, cuyo
 * índice trae código de servidor.
 */
export function ChangePasswordForm({
  hint,
  min,
  max,
}: {
  hint: string;
  min: number;
  max: number;
}) {
  return (
    <Disclosure
      icon={<KeyRound size={18} />}
      title="Cambiar contraseña"
      hint="Te pediremos la actual"
    >
      <ActionForm action={changePassword} label="Cambiar contraseña">
        <label>
          Contraseña actual
          <PasswordInput
            name="current_password"
            autoComplete="current-password"
            maxLength={max}
            required
          />
        </label>
        <label>
          Contraseña nueva
          <PasswordInput
            name="password"
            autoComplete="new-password"
            minLength={min}
            maxLength={max}
            required
            aria-describedby="new-password-rule"
          />
        </label>
        <p id="new-password-rule" className="small muted">
          {hint}
        </p>
        <label>
          Repite la contraseña nueva
          <PasswordInput
            name="confirm_password"
            autoComplete="new-password"
            minLength={min}
            maxLength={max}
            required
          />
        </label>
      </ActionForm>
    </Disclosure>
  );
}
