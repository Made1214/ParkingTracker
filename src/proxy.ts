import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/shared/lib/env";
import {
  REQUEST_ID_HEADER,
  apiError,
  newRequestId,
} from "@/shared/lib/api-errors";
import { RATE_LIMIT, hitRateLimit, isMutation } from "@/shared/lib/rate-limit";
import { safeNext } from "@/shared/lib/utils";

// Pantallas que no tienen sentido con sesión iniciada.
const AUTH_PAGES = ["/login", "/register"];
// Todo lo que cuelga de aquí exige sesión (cada pantalla lo vuelve a comprobar).
const PRIVATE_PAGES = ["/groups", "/profile", "/join"];

function under(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function proxy(request: NextRequest) {
  // Correlaciona la respuesta, los logs y Sentry (docs/05-API §5).
  const requestId = newRequestId();
  // Se rehace tras cada cambio de cookies para reenviar también el id.
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set(REQUEST_ID_HEADER, requestId);
    return NextResponse.next({ request: { headers } });
  };
  let response = forward();
  const { url, key } = publicEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items, headers) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = forward();
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search, searchParams } = request.nextUrl;
  const navigation = request.method === "GET" || request.method === "HEAD";

  // Redirección que conserva las cookies de sesión recién refrescadas.
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    redirect.headers.set("X-Request-Id", requestId);
    return redirect;
  };

  // Barrera central de la API: cada handler y RLS lo vuelven a comprobar,
  // pero una ruta nueva que olvide el chequeo no queda abierta.
  if (!signedIn && pathname.startsWith("/api/"))
    return apiError("UNAUTHENTICATED", {
      requestId,
      headers: { "Cache-Control": "private, no-store" },
    });

  if (navigation && !signedIn && under(pathname, PRIVATE_PAGES))
    return redirectTo(`/login?next=${encodeURIComponent(pathname + search)}`);

  if (navigation && signedIn && under(pathname, AUTH_PAGES)) {
    // getClaims solo valida el token; getUser confirma que la sesión sigue
    // viva en Supabase. Sin esto, una sesión revocada rebotaría entre
    // /login y las pantallas privadas (que usan getUser).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const next = safeNext(searchParams.get("next"));
      return redirectTo(next === "/" ? "/groups" : next);
    }
  }

  if (isMutation(request.method)) {
    // Por usuario; sin sesión (login, registro), por IP.
    const userId = data?.claims?.sub;
    const identity = userId ? `user:${userId}` : `ip:${clientIp(request)}`;
    const limit = await hitRateLimit(identity);
    if (!limit.allowed) {
      return apiError("RATE_LIMITED", {
        requestId,
        headers: {
          "Retry-After": String(limit.retryAfter),
          "X-RateLimit-Limit": String(RATE_LIMIT),
          "X-RateLimit-Remaining": "0",
          "Cache-Control": "private, no-store",
        },
      });
    }
    response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT));
    response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
  }

  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Request-Id", requestId);
  return response;
}
export const config = {
  matcher: [
    "/((?!api/health|_next/static|_next/image|favicon.ico|icon.svg|sw.js|offline.html|manifest.webmanifest|icons/|robots.txt|sitemap.xml|opengraph-image).*)",
  ],
};
