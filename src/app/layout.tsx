import type { Metadata } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
});
export const metadata: Metadata = {
  title: "Parking Tracker · Planes con tu gente",
  description: "Organiza salidas, reúne a tu grupo y confirma el próximo plan.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${manrope.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
