import "server-only";
import { headers } from "next/headers";
import { REQUEST_ID_HEADER, newRequestId } from "./api-errors";

/** El `request_id` que `src/proxy.ts` asignó a esta petición. */
export async function currentRequestId() {
  try {
    return (await headers()).get(REQUEST_ID_HEADER) ?? newRequestId();
  } catch {
    // Fuera de una petición (pruebas, scripts).
    return newRequestId();
  }
}
