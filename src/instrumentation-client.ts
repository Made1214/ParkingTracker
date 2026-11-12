import { sentryOptions } from "@/shared/lib/sentry";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

// Diferido: el SDK se descarga aparte y no entra en la carga inicial.
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) =>
    Sentry.init({ ...sentryOptions(dsn), tracesSampleRate: 0 }),
  );
}
