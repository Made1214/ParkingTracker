import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Parking Tracker · Planes con tu gente",
  description: "Organiza salidas, reúne a tu grupo y confirma el próximo plan.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
