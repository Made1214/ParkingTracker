import Link from "next/link";
import { ActionForm } from "@/shared/ui/action-form";
import { Input } from "@/shared/ui/input";
import { ThemeSelect } from "@/shared/ui/theme-select";
import { BrandMark } from "@/shared/ui/brand-mark";
import { requestPasswordReset, resetPassword } from "../api/recovery-actions";
import {
  PASSWORD_HINT,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from "../api/password-policy";

export function RecoveryScreen({ reset = false }: { reset?: boolean }) {
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link href="/" className="brand">
          <BrandMark />
          Parking Tracker
        </Link>
        <div>
          <span className="eyebrow">VUELVE A TUS PLANES</span>
          <h1>
            Tu grupo
            <br />
            te espera.
          </h1>
          <p>Recupera el acceso y sigue organizando la próxima salida.</p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <ThemeSelect />
          <h2>{reset ? "Elige tu nueva contraseña" : "Recupera tu cuenta"}</h2>
          <p className="muted">
            {reset
              ? "Usa una contraseña que no utilices en otros sitios."
              : "Te enviaremos un enlace para cambiar tu contraseña."}
          </p>
          <ActionForm
            action={reset ? resetPassword : requestPasswordReset}
            label={reset ? "Guardar contraseña" : "Enviar enlace"}
          >
            {reset ? (
              <>
                <label>
                  Nueva contraseña
                  <Input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={PASSWORD_MIN}
                    maxLength={PASSWORD_MAX}
                    aria-describedby="password-rule"
                  />
                </label>
                <p id="password-rule" className="small muted">
                  {PASSWORD_HINT}
                </p>
                <label>
                  Repite la contraseña
                  <Input
                    name="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={PASSWORD_MIN}
                    maxLength={PASSWORD_MAX}
                  />
                </label>
              </>
            ) : (
              <label>
                Correo electrónico
                <Input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
            )}
          </ActionForm>
          <p className="auth-switch">
            <Link href="/login">Volver a iniciar sesión</Link>
          </p>
          {reset && (
            <p className="small muted">
              <Link href="/forgot-password">Solicitar un nuevo enlace</Link>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
