import Link from "next/link";

/** Enlaces a privacidad y términos, para pies de página. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Información legal" className={className}>
      <Link href="/privacy">Privacidad</Link>
      <span aria-hidden="true"> · </span>
      <Link href="/terms">Términos</Link>
    </nav>
  );
}
