import Link from "next/link";
import { ActionForm } from "@/shared/ui/action-form";
import { Input } from "@/shared/ui/input";
import { ThemeSelect } from "@/shared/ui/theme-select";
import { requestPasswordReset, resetPassword } from "../api/recovery-actions";

export function RecoveryScreen({ reset = false }: { reset?: boolean }) {
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link href="/" className="brand">
          <span className="brand-icon">p.</span>parking tracker
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
                    minLength={8}
                    maxLength={128}
                  />
                </label>
                <label>
                  Repite la contraseña
                  <Input
                    name="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
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
          <Link href="/login">Volver a iniciar sesión</Link>
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
