import type { Metadata } from "next";
import Link from "next/link";
import { contactEmail, site } from "@/shared/lib/site";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: `Qué datos guarda ${site.name}, para qué y cómo eliminarlos.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  const email = contactEmail();
  return (
    <>
      <h1>Política de privacidad</h1>
      <p className={styles.updated}>
        Última actualización: {site.legalUpdatedAt}
      </p>

      <p>
        {site.name} sirve para organizar salidas con tu grupo. Esta página
        explica qué datos guardamos, para qué los usamos, con quién se comparten
        y cómo puedes borrarlos.
      </p>

      <h2>Qué datos guardamos</h2>
      <ul>
        <li>
          <strong>Tu cuenta:</strong> nombre, correo electrónico, nombre de
          usuario y foto de perfil si subes una. Si entras con Google, recibimos
          tu nombre y tu correo de Google. La contraseña nunca se guarda en
          texto legible.
        </li>
        <li>
          <strong>Lo que creas en un grupo:</strong> grupos, salidas, respuestas
          de asistencia, cronogramas, propuestas, votos, tareas, gastos y su
          reparto, comentarios y fotos.
        </li>
        <li>
          <strong>Datos técnicos:</strong> registros de errores del servidor y
          métricas de uso y rendimiento agregadas, sin cookies de publicidad.
        </li>
      </ul>

      <h2>Quién puede ver tus datos</h2>
      <p>
        Lo que creas dentro de un grupo solo lo ven las personas que pertenecen
        a ese grupo. La base de datos lo comprueba en cada consulta: alguien que
        no es miembro no puede leerlo aunque conozca el enlace. Las fotos se
        entregan a través de nuestro servidor solo después de comprobar que
        quien las pide es del grupo.
      </p>
      <p>No vendemos tus datos ni los usamos para publicidad.</p>

      <h2>Servicios que usamos</h2>
      <ul>
        <li>
          <strong>Supabase:</strong> base de datos e inicio de sesión.
        </li>
        <li>
          <strong>Cloudinary:</strong> almacenamiento privado de fotos, portadas
          y avatares.
        </li>
        <li>
          <strong>Vercel:</strong> alojamiento de la aplicación y métricas
          agregadas de uso y rendimiento.
        </li>
        <li>
          <strong>Sentry:</strong> reporte de errores, sin enviar tu dirección
          IP ni tus cookies.
        </li>
        <li>
          <strong>Google:</strong> solo si eliges entrar con tu cuenta de
          Google.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Usamos cookies propias solo para mantener tu sesión iniciada. El tema
        claro u oscuro se guarda en tu navegador. No usamos cookies de terceros
        ni de publicidad.
      </p>

      <h2>Cuánto tiempo guardamos los datos</h2>
      <p>
        Mientras tu cuenta exista. Si eliminas un grupo, se borran su contenido
        y sus imágenes.
      </p>

      <h2>Cómo eliminar tu cuenta</h2>
      <p>
        Desde <Link href="/profile">tu perfil</Link> puedes eliminar tu cuenta
        en cualquier momento. Se borran tu perfil y tu foto, y sales de todos
        tus grupos; si eras la única persona de un grupo, el grupo también se
        borra. Si participaste en gastos compartidos, tu cuenta se anonimiza
        («Cuenta eliminada») en lugar de borrarse, para que las cuentas del
        grupo sigan cuadrando, y ya no se puede volver a usar. Lo que
        compartiste en grupos que siguen activos puede seguir visible para ese
        grupo, sin tu nombre.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes consultar y corregir tus datos desde tu perfil, y pedirnos una
        copia o su eliminación.
        {email ? (
          <>
            {" "}
            Escríbenos a <a href={`mailto:${email}`}>{email}</a>.
          </>
        ) : (
          " Contacta al equipo de Parking Tracker."
        )}
      </p>

      <h2>Cambios</h2>
      <p>
        Si cambiamos esta política, actualizaremos la fecha de arriba y, si el
        cambio es importante, te avisaremos dentro de la aplicación.
      </p>
    </>
  );
}
