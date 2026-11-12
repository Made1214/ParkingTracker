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

export function memoryHit(key: string, now = Date.now()): RateLimitResult {
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
    allowed: bucket.count <= RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - bucket.count),
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
      allowed: count <= RATE_LIMIT,
      remaining: Math.max(0, RATE_LIMIT - count),
      retryAfter: seconds > 0 ? seconds : RATE_WINDOW_SECONDS,
    };
  } catch {
    return null;
  }
}

export async function hitRateLimit(identity: string): Promise<RateLimitResult> {
  const key = `rl:mut:${identity}`;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    const result = await upstashHit(key, url, token);
    if (result) return result;
    return { allowed: true, remaining: RATE_LIMIT, retryAfter: 0 };
  }
  return memoryHit(key);
}

/** Métodos que cuentan como mutación (las server actions llegan por POST). */
export function isMutation(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}
