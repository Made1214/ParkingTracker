import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/shared/lib/env";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = publicEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items, headers) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });
  await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!api/health|_next/static|_next/image|favicon.ico|icon.svg|sw.js|offline.html|manifest.webmanifest|icons/).*)",
  ],
};
