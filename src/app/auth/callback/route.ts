import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/shared/supabase/server";
import { publicEnv } from "@/shared/lib/env";
import { safeNext } from "@/shared/lib/utils";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await serverClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, publicEnv().appUrl));
  }
  return NextResponse.redirect(
    new URL(
      `/login?error=callback&next=${encodeURIComponent(next)}`,
      publicEnv().appUrl,
    ),
  );
}
