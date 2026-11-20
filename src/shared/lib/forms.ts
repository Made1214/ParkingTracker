export type ActionState = { error?: string; success?: string };
export function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
// Traduce errores comunes; cada acción contextualiza los casos de dominio.
export function databaseError(code?: string) {
  if (code === "42501") return "No tienes permiso para realizar esta acción.";
  if (code === "P0002") return "No se encontró el registro.";
  if (code === "23514")
    return "Revisa los datos. La acción no cumple las reglas del evento.";
  return "No se pudo guardar. Inténtalo de nuevo.";
}
