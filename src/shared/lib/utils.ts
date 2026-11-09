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
/** Iniciales para avatares: "Ana Torres" → "AT", "luis" → "LU". */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const letters =
    words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return letters.toUpperCase();
}
/** Fecha corta en Panamá, p. ej. "sáb, 14 nov". */
export function shortDate(value: string | Date) {
  return new Intl.DateTimeFormat("es-PA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Panama",
  })
    .format(new Date(value))
    .replace(/\./g, "");
}
/** Fecha larga en Panamá, p. ej. "lunes 9 de noviembre". */
export function longDate(value: string | Date) {
  return new Intl.DateTimeFormat("es-PA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Panama",
  })
    .format(new Date(value))
    .replace(",", "");
}
/** Tiempo restante legible: "5d 14h", "3h 20min" o "20min". */
export function countdown(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes % 60}min`;
  return `${minutes}min`;
}
/** Tiempo transcurrido legible: "ahora", "hace 12 min", "hace 3 h", "ayer", "hace 5 d". */
export function timeAgo(value: string | Date, now: number) {
  const minutes = Math.floor((now - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} d`;
  return shortDate(value);
}
