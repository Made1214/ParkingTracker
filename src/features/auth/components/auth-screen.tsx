import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ActionForm } from "@/shared/ui/action-form";
import { Input } from "@/shared/ui/input";
import { ThemeSelect } from "@/shared/ui/theme-select";
import { login, register, googleLogin } from "../api/actions";
import { BrandMark } from "@/shared/ui/brand-mark";
import { AuthOrbit } from "./auth-orbit";
export function AuthScreen({
  mode,
  next,
  failed,
}: {
  mode: "login" | "register";
  next: string;
  failed?: boolean;
}) {
  const signup = mode === "register";
  return (
    <main className="auth-layout">
      <section className="auth-story auth-story-orbit">
        <AuthOrbit />
        <Link href="/" className="brand">
          <BrandMark />
          Parking Tracker
        </Link>
        <div>
          <span className="eyebrow">MENOS CHAT. MÁS PLANES.</span>
          <h1 className="auth-headline">
            <span>
              <span>Planes claros.</span>
            </span>{" "}
            <span>
              <span>
                <em>Cero caos</em>
              </span>
            </span>{" "}
            <span>
              <span>de chat.</span>
            </span>
          </h1>
        </div>
        <p>
          Quién va, qué se hace y quién lleva qué, en un solo lugar.
          <br />
          Solo para tu grupo.
        </p>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <ThemeSelect />
          <span className="eyebrow">
            EL PRÓXIMO PLAN TE ESPERA <ArrowUpRight size={15} />
          </span>
          <h2>
            {signup
              ? "Haz espacio para más planes."
              : "Qué bueno verte de nuevo."}
          </h2>
          <p className="muted">
            {signup
              ? "Crea tu cuenta y reúne a tus personas favoritas."
              : "Entra y descubre qué está preparando tu grupo."}
          </p>
          {failed && (
            <p className="message error" role="alert">
              El enlace de acceso no es válido o ha caducado. Inténtalo de
              nuevo.
            </p>
          )}
          <ActionForm
            action={signup ? register : login}
            label={signup ? "Crear mi cuenta" : "Entrar a mis planes"}
          >
            <input type="hidden" name="next" value={next} />
            {signup && (
              <label>
                Tu nombre
                <Input
                  name="name"
                  autoComplete="name"
                  maxLength={80}
                  required
                  placeholder="¿Cómo te llama tu gente?"
                />
              </label>
            )}
            <label>
              Correo electrónico
              <Input
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="tu@correo.com"
              />
            </label>
            <label>
              Contraseña
              <Input
                type="password"
                name="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={8}
                maxLength={128}
                required
                placeholder="Al menos 8 caracteres"
              />
            </label>
          </ActionForm>
          {!signup && (
            <p className="small">
              <Link href="/forgot-password">¿Olvidaste tu contraseña?</Link>
            </p>
          )}
          <div className="divider">o continúa con</div>
          <ActionForm action={googleLogin} label="Continuar con Google">
            <input type="hidden" name="next" value={next} />
          </ActionForm>
          <p className="auth-switch">
            {signup ? "¿Ya tienes cuenta?" : "¿Primera vez por aquí?"}{" "}
            <Link
              href={`${signup ? "/login" : "/register"}?next=${encodeURIComponent(next)}`}
            >
              {signup ? "Inicia sesión" : "Crea tu cuenta"}
            </Link>
          </p>
          <p className="small muted">
            {signup ? "Al crear tu cuenta aceptas los " : "Consulta los "}
            <Link href="/terms">Términos de uso</Link> y la{" "}
            <Link href="/privacy">Política de privacidad</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
