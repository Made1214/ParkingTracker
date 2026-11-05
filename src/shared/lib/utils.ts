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
