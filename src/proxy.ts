import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/shared/lib/env";
import {
  REQUEST_ID_HEADER,
  apiError,
  newRequestId,
} from "@/shared/lib/api-errors";
import { RATE_LIMIT, hitRateLimit, isMutation } from "@/shared/lib/rate-limit";

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
