import type { Metadata } from "next";
import { Suspense } from "react";
import { logout } from "@/features/auth";
import { getShellData } from "@/features/groups";
import { InstallPrompt } from "@/shared/pwa";
import { AppSidebar } from "@/shared/ui/app-sidebar";
import { LegalLinks } from "@/shared/ui/legal-links";

// Todo lo que hay detrás del inicio de sesión es privado de cada grupo.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
          Buenos planes. Mejor compañía.
          <LegalLinks />
        </footer>
      </div>
      {shell && <InstallPrompt />}
    </div>
  );
}
