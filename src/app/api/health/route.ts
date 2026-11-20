import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { healthCheckSecret } from "@/shared/lib/env";
import { serverClient } from "@/shared/supabase/server";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function authorized(authHeader: string | null, secret: string) {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = Buffer.from(authHeader.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

// Comprueba que PostgREST puede ejecutar una consulta real en Postgres.
export async function GET(request: Request) {
  const secret = healthCheckSecret();
  if (secret && !authorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json(
      { status: "unauthorized" },
      { status: 401, headers },
    );
  }

  const time = new Date().toISOString();
  try {
    const supabase = await serverClient();
    const { data, error } = await supabase
      .rpc("database_healthcheck")
      .abortSignal(AbortSignal.timeout(5000));
    if (!error && data === true) {
      return NextResponse.json(
        { status: "ok", db: "ok", time },
        { status: 200, headers },
      );
    }
  } catch {
    // Los fallos de conexión y de inicialización comparten la respuesta 503.
  }
  return NextResponse.json(
    { status: "error", db: "error", time },
    { status: 503, headers },
  );
}
