import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function safeNext(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\r\n]/.test(value)
    ? value
    : "/";
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-PA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Panama",
  }).format(new Date(value));
}
// Los planes se viven en Panamá (UTC−5, sin horario de verano).
const PANAMA_OFFSET_MS = 5 * 60 * 60 * 1000;
/** ISO → valor de <input type="datetime-local"> en hora de Panamá. */
export function panamaInput(value: string) {
  return new Date(Date.parse(value) - PANAMA_OFFSET_MS)
    .toISOString()
    .slice(0, 16);
}
/** Valor de <input type="datetime-local"> en hora de Panamá → ISO. */
export function fromPanamaInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}:00-05:00`);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}
/** Hora corta en Panamá, p. ej. "08:30". */
export function panamaTime(value: string) {
  return new Intl.DateTimeFormat("es-PA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Panama",
  }).format(new Date(value));
}
