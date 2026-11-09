"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  House,
  ListChecks,
  LogOut,
  Plus,
  Settings2,
  UserRound,
  Wallet,
} from "lucide-react";
import { BrandMark } from "./brand-mark";
import { ThemeSelect } from "./theme-select";
import { initials } from "@/shared/lib/utils";
import styles from "./app-sidebar.module.css";

type ShellGroup = { id: string; name: string };

const ROUTE =
  /^\/groups\/([0-9a-f-]{36})(?:\/events\/([0-9a-f-]{36}))?(\/settings)?/i;

/**
 * Navegación principal: barra lateral en escritorio y barra superior +
 * navegación inferior en móvil. El grupo activo sale de la URL; si no hay
 * ninguno, se usa el primero para "Nueva salida".
 */
export function AppSidebar({
  groups,
  displayName,
  logout,
}: {
  groups: ShellGroup[];
  displayName: string;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const section = useSearchParams().get("section") ?? "plan";
  const [, groupId, eventId, settings] = pathname.match(ROUTE) ?? [];
  const current = groups.find((group) => group.id === groupId);
  const target = current ?? groups[0];
  const groupUrl = target ? `/groups/${target.id}` : "/groups";
  const eventUrl = eventId ? `/groups/${groupId}/events/${eventId}` : null;
  const newEvent = target
    ? { href: `${groupUrl}#nueva-salida`, label: "Nueva salida" }
    : { href: "/groups#crear-grupo", label: "Crear grupo" };

  const item = (
    href: string,
    label: string,
    icon: ReactNode,
    active: boolean,
    sub = false,
  ) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={sub ? styles.sub : undefined}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.top}>
        <Link href="/groups" className={styles.brand}>
          <BrandMark />
          <span>Parking Tracker</span>
        </Link>
        {groups.length > 0 && (
          <details key={pathname} className={styles.switcher}>
            <summary>
              <span className={styles.groupBadge} aria-hidden="true">
                {(current ?? target)?.name.slice(0, 1).toUpperCase()}
              </span>
              <span className={styles.groupText}>
                <small>GRUPO</small>
                <strong>{current?.name ?? "Mis grupos"}</strong>
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className={styles.menu}>
              {groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  aria-current={group.id === groupId ? "true" : undefined}
                >
                  {group.name}
                </Link>
              ))}
              <Link href="/groups#crear-grupo" className={styles.menuExtra}>
                <Plus size={15} aria-hidden="true" /> Crear o unirme a un grupo
              </Link>
            </div>
          </details>
        )}
      </div>
      <Link href={newEvent.href} className={styles.cta}>
        <Plus size={18} aria-hidden="true" /> {newEvent.label}
      </Link>
      <nav aria-label="Principal" className={styles.nav}>
        {item(
          "/groups",
          "Inicio",
          <House size={19} aria-hidden="true" />,
          pathname === "/groups",
        )}
        {target &&
          item(
            groupUrl,
            "Salidas",
            <CalendarDays size={19} aria-hidden="true" />,
            Boolean(current && !settings && !eventId),
          )}
        {eventUrl && (
          <div className={styles.subnav} aria-label="Esta salida">
            {item(
              eventUrl,
              "Plan",
              <CalendarDays size={16} aria-hidden="true" />,
              section === "plan",
              true,
            )}
            {item(
              `${eventUrl}?section=votaciones`,
              "Votos",
              <BarChart3 size={16} aria-hidden="true" />,
              section === "votaciones",
              true,
            )}
            {item(
              `${eventUrl}?section=gastos`,
              "Gastos",
              <Wallet size={16} aria-hidden="true" />,
              section === "gastos",
              true,
            )}
            {item(
              `${eventUrl}?section=tareas`,
              "Tareas",
              <ListChecks size={16} aria-hidden="true" />,
              section === "tareas",
              true,
            )}
          </div>
        )}
        {target &&
          item(
            `${groupUrl}/settings`,
            "Grupo y ajustes",
            <Settings2 size={19} aria-hidden="true" />,
            Boolean(settings),
          )}
        {item(
          "/profile",
          "Mi perfil",
          <UserRound size={19} aria-hidden="true" />,
          pathname.startsWith("/profile"),
        )}
      </nav>
      <div className={styles.foot}>
        <Link href="/profile" className={styles.user}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(displayName)}
          </span>
          <span>
            <strong>{displayName || "Tu perfil"}</strong>
            <small>Ver perfil</small>
          </span>
        </Link>
        <div className={styles.footActions}>
          <ThemeSelect />
          <form action={logout}>
            <button
              type="submit"
              className={styles.iconButton}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
      <nav aria-label="Accesos rápidos" className={styles.bottomNav}>
        {item(
          "/groups",
          "Inicio",
          <House size={20} aria-hidden="true" />,
          pathname === "/groups",
        )}
        {item(
          target ? groupUrl : "/groups#mis-grupos",
          "Salidas",
          <CalendarDays size={20} aria-hidden="true" />,
          Boolean(current && !settings),
        )}
        <Link
          href={newEvent.href}
          className={styles.fab}
          aria-label={newEvent.label}
        >
          <Plus size={24} aria-hidden="true" />
        </Link>
        {item(
          target ? `${groupUrl}/settings` : "/groups#crear-grupo",
          "Grupo",
          <Settings2 size={20} aria-hidden="true" />,
          Boolean(settings),
        )}
        {item(
          "/profile",
          "Perfil",
          <UserRound size={20} aria-hidden="true" />,
          pathname.startsWith("/profile"),
        )}
      </nav>
    </aside>
  );
}
