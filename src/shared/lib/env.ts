export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!url || !key || !appUrl) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) o NEXT_PUBLIC_APP_URL. Copia .env.example a .env.local.",
    );
  }
  for (const value of [url, appUrl]) {
    if (!["http:", "https:"].includes(new URL(value).protocol))
      throw new Error("La configuración requiere URLs HTTP(S).");
  }
  return { url, key, appUrl: new URL(appUrl).origin };
}

export function healthCheckSecret() {
  const secret =
    process.env.HEALTH_CHECK_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  return secret || null;
}
