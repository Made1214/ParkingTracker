import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types.generated";
import { publicEnv } from "@/shared/lib/env";
export function browserClient() {
  const { url, key } = publicEnv();
  return createBrowserClient<Database>(url, key);
}
