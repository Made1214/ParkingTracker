import Link from "next/link";
import { ChevronRight } from "lucide-react";
import styles from "./breadcrumbs.module.css";

export type Crumb = { label: string; href?: string };

/**
 * Migas de pan según el sitemap (Inicio › Grupo › Salida). La última es la
 * página actual y no es un enlace; en pantallas estrechas se recorta con
 * puntos suspensivos para que la ruta quepa en una línea.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Migas de pan" className={styles.crumbs}>
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${index}-${item.label}`}>
              {item.href && !last ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span aria-current={last ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight size={14} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
