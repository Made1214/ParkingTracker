import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PwaRuntime } from "@/shared/pwa";
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
  applicationName: "Parking Tracker",
  appleWebApp: {
    capable: true,
    title: "Parking Tracker",
    statusBarStyle: "default",
  },
};
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#121120" },
  ],
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
          <PwaRuntime />
        </ThemeProvider>
        {/* Solo envían datos en Vercel; no usan cookies ni datos personales. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
