/** Datos públicos del sitio: metadatos, páginas legales y SEO. */
export const site = {
  name: "Parking Tracker",
  title: "Parking Tracker · Planes con tu gente",
  description:
    "Organiza salidas con tu grupo: quién va, qué se hace, cuánto puso cada quien y las fotos del día, en un solo lugar privado.",
  locale: "es_PA",
  /** Fecha de la última revisión de privacidad y términos. */
  legalUpdatedAt: "12 de noviembre de 2026",
};

/** Correo de contacto para privacidad y soporte (opcional). */
export function contactEmail() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** Rutas públicas que pueden indexarse. Todo lo demás requiere sesión. */
export const publicRoutes = ["/login", "/register", "/privacy", "/terms"];
