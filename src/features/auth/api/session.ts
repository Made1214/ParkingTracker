import "server-only";
import { redirect } from "next/navigation";
import { serverClient } from "@/shared/supabase/server";
export async function requireUser(next = "/") {
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}
