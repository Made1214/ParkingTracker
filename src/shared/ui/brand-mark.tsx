import { cn } from "@/shared/lib/utils";

const TICKET =
  "M35 12H44A6 6 0 0 0 56 12H65A8 8 0 0 1 73 20V80A8 8 0 0 1 65 88H56A6 6 0 0 0 44 88H35A8 8 0 0 1 27 80V20A8 8 0 0 1 35 12Z";
const LETTER =
  "M40.31 72.32V27.68H58.75Q59.4 27.68 60.43 27.73Q61.45 27.77 62.32 27.93Q66.19 28.52 68.72 30.5Q71.24 32.48 72.47 35.51Q73.69 38.53 73.69 42.22Q73.69 45.88 72.45 48.9Q71.21 51.92 68.69 53.91Q66.16 55.89 62.32 56.48Q61.45 56.6 60.41 56.66Q59.37 56.73 58.75 56.73H47.78V72.32ZM47.78 49.75H58.44Q59.06 49.75 59.84 49.69Q60.61 49.63 61.26 49.44Q63.12 48.98 64.19 47.8Q65.26 46.62 65.71 45.13Q66.16 43.64 66.16 42.22Q66.16 40.79 65.71 39.29Q65.26 37.79 64.19 36.61Q63.12 35.43 61.26 34.96Q60.61 34.78 59.84 34.73Q59.06 34.69 58.44 34.69H47.78Z";
const SPARKS =
  "M21 14.5Q22.19 21.81 29.5 23Q22.19 24.19 21 31.5Q19.81 24.19 12.5 23Q19.81 21.81 21 14.5ZM79 27.8Q79.45 30.55 82.2 31Q79.45 31.45 79 34.2Q78.55 31.45 75.8 31Q78.55 30.55 79 27.8Z";
const ACCENT_SPARK =
  "M34 4.5Q34.63 8.37 38.5 9Q34.63 9.63 34 13.5Q33.37 9.63 29.5 9Q33.37 8.37 34 4.5Z";

/**
 * Isotipo de Parking Tracker: ticket en diagonal, "P" y destellos.
 * Los colores salen de --mark-ticket, --mark-letter y --mark-accent, con
 * valores por defecto del tema activo (ver globals.css).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("brand-mark", className)}
      aria-hidden="true"
      focusable="false"
    >
      <mask
        id="brand-mark-gap"
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="100"
        height="100"
      >
        <rect width="100" height="100" fill="#fff" />
        <path
          d={LETTER}
          fill="#000"
          stroke="#000"
          strokeWidth="11"
          strokeLinejoin="round"
        />
      </mask>
      <path
        d={TICKET}
        transform="rotate(45 50 50)"
        fill="none"
        stroke="var(--mark-ticket)"
        strokeWidth="6"
        strokeLinejoin="round"
        mask="url(#brand-mark-gap)"
      />
      <path d={LETTER} fill="var(--mark-letter)" />
      <path d={SPARKS} fill="var(--mark-letter)" />
      <circle cx="13" cy="40" r="3.2" fill="var(--mark-letter)" />
      <path d={ACCENT_SPARK} fill="var(--mark-accent)" />
    </svg>
  );
}
