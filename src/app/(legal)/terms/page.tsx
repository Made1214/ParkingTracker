import type { Metadata } from "next";
import Link from "next/link";
import { contactEmail, site } from "@/shared/lib/site";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: `Las reglas para usar ${site.name}.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  const email = contactEmail();
  return (
    <>
      <h1>Términos de uso</h1>
      <p className={styles.updated}>
        Última actualización: {site.legalUpdatedAt}
      </p>

      <p>
        Al crear una cuenta o usar {site.name} aceptas estos términos y la{" "}
        <Link href="/privacy">política de privacidad</Link>.
      </p>

      <h2>El servicio</h2>
      <p>
        {site.name} ayuda a grupos de amigos a organizar salidas: asistencia,
        cronograma, votaciones, tareas, gastos compartidos, comentarios y fotos.
        Es gratuito y se ofrece tal cual, sin garantía de disponibilidad
        continua.
      </p>

      <h2>Tu cuenta</h2>
      <ul>
        <li>Debes dar un correo real y mantener tu contraseña en privado.</li>
        <li>Eres responsable de lo que se haga desde tu cuenta.</li>
        <li>
          Puedes eliminar tu cuenta cuando quieras desde{" "}
          <Link href="/profile">tu perfil</Link>.
        </li>
      </ul>

      <h2>Lo que publicas</h2>
      <ul>
        <li>
          Lo que subes sigue siendo tuyo. Nos das permiso para guardarlo y
          mostrarlo a los miembros de tu grupo, solo para que el servicio
          funcione.
        </li>
        <li>
          Sube solo fotos y contenido que tengas derecho a compartir, y respeta
          a las personas que aparecen en ellas.
        </li>
        <li>
          No publiques contenido ilegal, acosador, violento o que exponga datos
          de otras personas sin su permiso.
        </li>
      </ul>

      <h2>Gastos compartidos</h2>
      <p>
        Los saldos y las transferencias sugeridas son una ayuda para ordenar las
        cuentas del grupo. {site.name} no procesa pagos ni responde por los
        acuerdos de dinero entre los miembros.
      </p>

      <h2>Uso razonable</h2>
      <p>
        No intentes acceder a grupos de los que no eres miembro, saturar el
        servicio ni automatizar su uso. Limitamos la cantidad de cambios por
        minuto para proteger a todos.
      </p>

      <h2>Suspensión</h2>
      <p>
        Podemos suspender cuentas que incumplan estos términos. Los
        administradores de cada grupo pueden quitar miembros y borrar contenido
        de su grupo.
      </p>

      <h2>Cambios y contacto</h2>
      <p>
        Si cambiamos estos términos, actualizaremos la fecha de arriba.
        {email ? (
          <>
            {" "}
            Para cualquier duda, escríbenos a{" "}
            <a href={`mailto:${email}`}>{email}</a>.
          </>
        ) : (
          " Para cualquier duda, contacta al equipo de Parking Tracker."
        )}
      </p>
    </>
  );
}
