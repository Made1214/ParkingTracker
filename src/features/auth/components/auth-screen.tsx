import Link from "next/link";
import { ArrowUpRight, CalendarDays, Users, Check } from "lucide-react";
import { ActionForm } from "@/shared/ui/action-form";
import { Input } from "@/shared/ui/input";
import { ThemeSelect } from "@/shared/ui/theme-select";
import { login, register, googleLogin } from "../api/actions";
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
      <section className="auth-story">
        <Link href="/" className="brand">
          <span className="brand-icon">p.</span>parking tracker
        </Link>
        <div>
          <span className="eyebrow">MENOS CHAT. MÁS PLANES.</span>
          <h1>
            Los mejores planes
            <br />
            empiezan con
            <br />
            <em>tu gente.</em>
          </h1>
          <p>
            Un lugar para organizar la próxima salida.
            <br />Y todas las historias que vienen después.
          </p>
        </div>
        <div className="story-notes">
          <span>
            <CalendarDays size={18} /> Arma el plan
          </span>
          <span>
            <Users size={18} /> Reúne al grupo
          </span>
          <span>
            <Check size={18} /> Confirma y disfruta
          </span>
        </div>
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
            Tus planes y recuerdos, solo para tu grupo.
          </p>
        </div>
      </section>
    </main>
  );
}
