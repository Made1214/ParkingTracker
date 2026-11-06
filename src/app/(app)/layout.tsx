import Link from "next/link";
import { Compass, LogOut, UserRound } from "lucide-react";
import { logout } from "@/features/auth";
import { Button } from "@/shared/ui/button";
import { ThemeSelect } from "@/shared/ui/theme-select";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="app-header">
        <Link href="/groups" className="brand">
          <span className="brand-icon">p.</span>parking tracker
        </Link>
        <nav aria-label="Principal">
          <ThemeSelect />
          <Link href="/groups">
            <Compass size={18} /> Mis grupos
          </Link>
          <Link href="/profile">
            <UserRound size={18} /> Mi perfil
          </Link>
          <form action={logout}>
            <Button variant="ghost" type="submit" aria-label="Cerrar sesión">
              <LogOut size={17} />
              <span>Salir</span>
            </Button>
          </form>
        </nav>
      </header>
      <main id="main" className="app-main">
        {children}
      </main>
      <footer className="app-footer">
        Buenos planes. Mejor compañía.<span>Parking Tracker</span>
      </footer>
    </>
  );
}
