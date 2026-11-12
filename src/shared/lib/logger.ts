/**
 * Logs estructurados (RNF-13): una línea JSON por evento, que Vercel indexa
 * por campo. Nunca registrar cuerpos de petición, tokens ni datos de perfil.
 */
type Level = "info" | "warn" | "error";

export function log(
  level: Level,
  message: string,
  fields: Record<string, unknown> = {},
) {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Resume un error sin filtrar datos: nombre, mensaje y digest de Next. */
export function describeError(error: unknown) {
  if (error instanceof Error)
    return {
      name: error.name,
      message: error.message,
      digest: (error as { digest?: string }).digest,
    };
  return { name: "UnknownError", message: String(error) };
}
