"use client";

/** Envía a Sentry un error capturado por un error boundary (si hay DSN). */
export function reportClientError(error: Error & { digest?: string }) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import("@sentry/nextjs").then((Sentry) =>
    Sentry.captureException(error, {
      tags: error.digest ? { digest: error.digest } : undefined,
    }),
  );
}
