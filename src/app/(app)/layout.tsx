import { Suspense } from "react";
import { logout } from "@/features/auth";
import { getShellData } from "@/features/groups";
import { AppSidebar } from "@/shared/ui/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = await getShellData();
  return (
    <div className="app-shell">
      {shell && (
        <Suspense>
          <AppSidebar
            groups={shell.groups}
            displayName={shell.displayName}
            logout={logout}
          />
        </Suspense>
      )}
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
