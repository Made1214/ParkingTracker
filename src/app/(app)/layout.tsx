import Link from "next/link";
import { Compass, LogOut, UserRound } from "lucide-react";
import { logout } from "@/features/auth";
import { Button } from "@/shared/ui/button";
import { NavLink } from "@/shared/ui/nav-link";
import { ThemeSelect } from "@/shared/ui/theme-select";
import { BrandMark } from "@/shared/ui/brand-mark";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href="/groups" className="brand">
          <BrandMark />
          Parking Tracker
        </Link>
        <nav aria-label="Principal" className="app-nav">
          <NavLink href="/groups" label="Mis grupos">
            <Compass size={18} aria-hidden="true" />
          </NavLink>
          <NavLink href="/profile" label="Mi perfil">
            <UserRound size={18} aria-hidden="true" />
          </NavLink>
        </nav>
        <div className="app-sidebar-foot">
          <ThemeSelect />
          <form action={logout}>
            <Button variant="ghost" type="submit" aria-label="Cerrar sesión">
              <LogOut size={17} aria-hidden="true" />
            </Button>
          </form>
        </div>
      </aside>
      <div className="app-content">
        <main id="main" className="app-main">
          {children}
        </main>
        <footer className="app-footer">
          Buenos planes. Mejor compañía.<span>Parking Tracker</span>
        </footer>
      </div>
    </div>
  );
}
