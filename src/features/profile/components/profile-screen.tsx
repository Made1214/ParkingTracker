import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  PASSWORD_HINT,
  PASSWORD_MAX,
  PASSWORD_MIN,
  requireUser,
} from "@/features/auth";
import { InstallCard } from "@/shared/pwa";
import { Card } from "@/shared/ui/card";
import { ThemeSelect } from "@/shared/ui/theme-select";
import { ChangePasswordForm } from "./change-password-form";
import { ProfileForm } from "./profile-form";
import { suggestUsername } from "../api/username";

// Carga el perfil y las opciones que permite su método de autenticación.
export async function ProfileScreen({
  passwordUpdated = false,
}: {
  passwordUpdated?: boolean;
}) {
  const { supabase, user } = await requireUser("/profile");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_public_id, updated_at")
    .eq("id", user.id)
    .single();
  if (error)
    throw new Error("No se pudo cargar tu perfil. Inténtalo de nuevo.");
  return (
    <>
      <Link href="/groups" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Volver al inicio
      </Link>
      <div className="page-heading">
        <div>
          <h1>Mi perfil</h1>
          <p className="muted">Tu identidad en los planes que compartes.</p>
        </div>
      </div>
      {passwordUpdated && (
        <p role="status" className="message success">
          Tu contraseña se actualizó.
        </p>
      )}
      <ProfileForm
        key={profile.updated_at}
        profile={profile}
        suggestion={profile.username ? null : suggestUsername(user.email)}
      >
        <Card className="appearance-card">
          <div>
            <h2>Apariencia</h2>
            <p className="small muted">
              Claro, oscuro o el mismo tema que tu dispositivo.
            </p>
          </div>
          <ThemeSelect />
        </Card>
        <InstallCard />
      </ProfileForm>
      {/* Las cuentas que entran solo con Google no tienen contraseña. */}
      {user.identities?.some((identity) => identity.provider === "email") && (
        <ChangePasswordForm
          hint={PASSWORD_HINT}
          min={PASSWORD_MIN}
          max={PASSWORD_MAX}
        />
      )}
    </>
  );
}
