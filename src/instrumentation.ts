import type { Instrumentation } from "next";
import { describeError, log } from "@/shared/lib/logger";
import { sentryOptions } from "@/shared/lib/sentry";

const dsn = process.env.SENTRY_DSN?.trim();

export async function register() {
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init(sentryOptions(dsn));
}

/** Todo error no controlado del servidor: log estructurado y, si hay DSN, Sentry. */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const header = request.headers["x-request-id"];
  const requestId = Array.isArray(header) ? header[0] : header;
  log("error", "request_error", {
    request_id: requestId,
    method: request.method,
    // Solo la ruta: la query puede llevar tokens (invitaciones, recuperación).
    path: request.path.split("?")[0],
    route: context.routePath,
    route_type: context.routeType,
    error: describeError(error),
  });
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.withScope((scope) => {
    if (requestId) scope.setTag("request_id", requestId);
    Sentry.captureRequestError(error, request, context);
  });
};
