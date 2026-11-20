import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { BrandMark } from "@/shared/ui/brand-mark";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Disclosure } from "@/shared/ui/disclosure";
import { Input } from "@/shared/ui/input";
import { ThemeSelect } from "@/shared/ui/theme-select";
import styles from "./ui.module.css";

export const metadata: Metadata = {
  title: "Componentes",
  robots: { index: false, follow: false },
};

/**
 * Galería de componentes de `shared/ui` en claro y oscuro, lado a lado
 * (criterio de aceptación de E1.F4). Es una herramienta de desarrollo: en
 * producción la ruta no existe.
 */
// Muestra los componentes compartidos en ambos temas durante el desarrollo.
export default function UiGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main id="main" className={styles.page}>
      <h1>Componentes</h1>
      <p className="muted">
        Cada muestra se renderiza dos veces con los tokens de Noche serena: a la
        izquierda el tema claro y a la derecha el oscuro.
      </p>
      {samples.map(({ title, sample }) => (
        <section key={title} aria-labelledby={`ui-${title}`}>
          <h2 id={`ui-${title}`}>{title}</h2>
          <div className={styles.pair}>
            <div className={styles.theme}>
              <span className="eyebrow">CLARO</span>
              {sample}
            </div>
            <div className={`${styles.theme} dark`}>
              <span className="eyebrow">OSCURO</span>
              {sample}
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}

const samples = [
  {
    title: "Botones",
    sample: (
      <div className={styles.row}>
        <Button>Guardar</Button>
        <Button variant="outline">Cancelar</Button>
        <Button variant="ghost">Omitir</Button>
        <Button variant="danger">
          <Trash2 size={16} aria-hidden="true" /> Eliminar
        </Button>
        <Button disabled>
          <Plus size={16} aria-hidden="true" /> Deshabilitado
        </Button>
      </div>
    ),
  },
  {
    title: "Campos",
    sample: (
      <div className={styles.stack}>
        <label>
          Título
          <Input placeholder="Asado en la playa" />
        </label>
        <label>
          Con valor
          <Input defaultValue="Cumple de Luis" />
        </label>
        <label>
          Deshabilitado
          <Input disabled defaultValue="No editable" />
        </label>
      </div>
    ),
  },
  {
    title: "Tarjeta",
    sample: (
      <Card>
        <h3>Asistencia</h3>
        <p className="small muted">8 van · 2 quizás · 1 no va</p>
      </Card>
    ),
  },
  {
    title: "Sección desplegable",
    sample: (
      <div className={styles.stack}>
        <Disclosure title="Abierta" hint="Con pista" defaultOpen>
          Contenido de la sección.
        </Disclosure>
        <Disclosure title="Cerrada" tone="danger">
          Acción delicada.
        </Disclosure>
      </div>
    ),
  },
  {
    title: "Migas de pan",
    sample: (
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/groups" },
          { label: "Los de siempre", href: "/groups" },
          { label: "Asado en la playa con un nombre bastante largo" },
        ]}
      />
    ),
  },
  {
    title: "Marca y selector de tema",
    sample: (
      <div className={styles.row}>
        <span className={styles.mark}>
          <BrandMark />
        </span>
        <ThemeSelect />
      </div>
    ),
  },
];
