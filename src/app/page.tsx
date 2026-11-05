import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/features/auth";
import { serverClient } from "@/shared/supabase/server";
import { Button } from "@/shared/ui/button";

export default async function Home() {
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="app-main">
      <h1>Sesión iniciada</h1>
      <p className="muted">{user.email}</p>
      <form action={logout}>
        <Button variant="outline" type="submit">
          <LogOut size={17} />
          <span>Salir</span>
        </Button>
      </form>
    </main>
  );
}
