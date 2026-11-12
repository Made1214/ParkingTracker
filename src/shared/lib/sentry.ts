/**
 * Configuración común de Sentry. Sentry solo se activa si existe el DSN
 * (`SENTRY_DSN` en el servidor, `NEXT_PUBLIC_SENTRY_DSN` en el navegador),
 * y se importa de forma diferida para no pesar en la carga inicial.
 */
export function sentryOptions(dsn: string) {
  return {
    dsn,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    tracesSampleRate: 0.1,
    // No enviar IP, cookies ni cabeceras del usuario.
    sendDefaultPii: false,
  };
}
