/**
 * Límite de peticiones para mutaciones: 60 por minuto por usuario
 * (docs/05-API §5). Ventana fija de 60 s.
 *
 * - Con `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, el contador
 *   vive en Upstash Redis y es compartido por todas las instancias.
 * - Sin ellas, cae a un contador en memoria por instancia (suficiente en
 *   desarrollo y como freno básico; en Vercel cada instancia cuenta aparte).
 *
 * Si Upstash falla, la petición pasa (fail-open): el límite protege contra
 * abuso, no es una barrera de autorización — esa es RLS.
 */
export const RATE_LIMIT = 60;
export const RATE_WINDOW_SECONDS = 60;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Segundos hasta que se reinicia la ventana. */
  retryAfter: number;
};

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type RateLimitOptions = {
  /** Intentos permitidos por ventana (por defecto, el límite general). */
  limit?: number;
  /** Separa contadores de usos distintos (por defecto, las mutaciones). */
  scope?: string;
};

/** Lectura sin contar: ¿queda margen en la ventana actual? */
export function memoryPeek(
  key: string,
  now = Date.now(),
  limit = RATE_LIMIT,
): RateLimitResult {
  const bucket = buckets.get(key);
  const count = bucket && bucket.resetAt > now ? bucket.count : 0;
  return {
    allowed: count < limit,
    remaining: Math.max(0, limit - count),
    retryAfter: bucket
      ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      : RATE_WINDOW_SECONDS,
  };
}

export function memoryHit(
  key: string,
  now = Date.now(),
  limit = RATE_LIMIT,
): RateLimitResult {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_BUCKETS) buckets.clear();
    }
    bucket = { count: 0, resetAt: now + RATE_WINDOW_SECONDS * 1000 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function resetMemoryRateLimit() {
  buckets.clear();
}

async function upstashHit(
  key: string,
  url: string,
  token: string,
  limit: number,
): Promise<RateLimitResult | null> {
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(RATE_WINDOW_SECONDS), "NX"],
        ["TTL", key],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return null;
    const [incr, , ttl] = (await response.json()) as { result?: number }[];
    const count = Number(incr?.result);
    if (!Number.isFinite(count)) return null;
    const seconds = Number(ttl?.result);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfter: seconds > 0 ? seconds : RATE_WINDOW_SECONDS,
    };
  } catch {
    return null;
  }
}

async function upstashPeek(
  key: string,
  url: string,
  token: string,
  limit: number,
): Promise<RateLimitResult | null> {
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["GET", key],
        ["TTL", key],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return null;
    const [value, ttl] = (await response.json()) as { result?: unknown }[];
    const count = Number(value?.result ?? 0);
    if (!Number.isFinite(count)) return null;
    const seconds = Number(ttl?.result);
    return {
      allowed: count < limit,
      remaining: Math.max(0, limit - count),
      retryAfter: seconds > 0 ? seconds : RATE_WINDOW_SECONDS,
    };
  } catch {
    return null;
  }
}

export async function hitRateLimit(
  identity: string,
  { limit = RATE_LIMIT, scope = "mut" }: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const key = `rl:${scope}:${identity}`;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    const result = await upstashHit(key, url, token, limit);
    if (result) return result;
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
  return memoryHit(key, Date.now(), limit);
}

/** Como `hitRateLimit`, pero sin sumar un intento: solo mira si queda margen. */
export async function peekRateLimit(
  identity: string,
  { limit = RATE_LIMIT, scope = "mut" }: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const key = `rl:${scope}:${identity}`;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    const result = await upstashPeek(key, url, token, limit);
    if (result) return result;
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
  return memoryPeek(key, Date.now(), limit);
}

/** Métodos que cuentan como mutación (las server actions llegan por POST). */
export function isMutation(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}
