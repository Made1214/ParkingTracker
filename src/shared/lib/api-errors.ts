/**
 * Formato de error uniforme de la API (docs/05-API §5):
 * `{ "error": { "code", "message", "details"?, "request_id" } }`.
 * Los 4xx nunca exponen detalles internos (SQL, trazas).
 */
export const REQUEST_ID_HEADER = "x-request-id";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "BUSINESS_RULE"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "UPSTREAM_ERROR"
  | "SERVICE_UNAVAILABLE";

const defaults: Record<ApiErrorCode, { status: number; message: string }> = {
  VALIDATION_ERROR: { status: 400, message: "La petición no es válida." },
  UNAUTHENTICATED: { status: 401, message: "Inicia sesión para continuar." },
  FORBIDDEN: { status: 403, message: "No tienes permiso para hacer esto." },
  NOT_FOUND: { status: 404, message: "No encontramos lo que buscas." },
  CONFLICT: { status: 409, message: "Ya existe un registro igual." },
  PAYLOAD_TOO_LARGE: {
    status: 413,
    message: "El archivo es demasiado grande.",
  },
  BUSINESS_RULE: { status: 422, message: "La acción no está permitida ahora." },
  RATE_LIMITED: {
    status: 429,
    message: "Demasiadas peticiones. Espera un momento e inténtalo de nuevo.",
  },
  INTERNAL: { status: 500, message: "Algo salió mal. Inténtalo de nuevo." },
  UPSTREAM_ERROR: {
    status: 502,
    message: "Un servicio externo no respondió como esperábamos.",
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    message: "El servicio no está disponible en este momento.",
  },
};

/** `req_` + 12 caracteres hexadecimales aleatorios. */
export function newRequestId() {
  return `req_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export function apiError(
  code: ApiErrorCode,
  options: {
    requestId: string;
    message?: string;
    details?: { field: string; issue: string }[];
    headers?: HeadersInit;
  },
) {
  const { status, message } = defaults[code];
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Request-Id", options.requestId);
  // Un error nunca se guarda en caché (p. ej. un 404 de foto antes de subirse).
  headers.set("Cache-Control", "private, no-store");
  return new Response(
    JSON.stringify({
      error: {
        code,
        message: options.message ?? message,
        ...(options.details ? { details: options.details } : {}),
        request_id: options.requestId,
      },
    }),
    { status, headers },
  );
}
