import Link from "next/link";
import { requireUser } from "@/features/auth";
import { Card } from "@/shared/ui/card";
import { ThemeSelect } from "@/shared/ui/theme-select";
import { ProfileForm } from "./profile-form";

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
        Volver a mis grupos
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
      <ProfileForm key={profile.updated_at} profile={profile} />
      <Card className="appearance-card">
        <div>
          <h2>Apariencia</h2>
          <p className="small muted">
            Claro, oscuro o el mismo tema que tu dispositivo.
          </p>
        </div>
        <ThemeSelect />
      </Card>
    </>
  );
}
