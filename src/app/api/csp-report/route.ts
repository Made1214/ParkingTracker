import { clientIp } from "@/shared/lib/client-ip";
import { log } from "@/shared/lib/logger";
import { hitRateLimit } from "@/shared/lib/rate-limit";
import { z } from "zod";

const MAX_BYTES = 16_384;
const directive = z.string().regex(/^[a-z][a-z0-9-]{1,40}$/);
const legacy = z.object({
  "csp-report": z.object({ "effective-directive": directive }),
});
const modern = z
  .array(
    z.object({
      type: z.literal("csp-violation"),
      body: z.object({ effectiveDirective: directive }),
    }),
  )
  .max(20);

/** Recibe reportes acotados y registra únicamente la directiva que falló. */
export async function POST(request: Request) {
  const type = request.headers.get("content-type")?.split(";")[0];
  if (type !== "application/csp-report" && type !== "application/reports+json")
    return new Response(null, { status: 415 });
  const limit = await hitRateLimit(clientIp(request.headers), {
    scope: "csp-report",
    limit: 30,
  });
  if (!limit.allowed) return new Response(null, { status: 429 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    const report: unknown = JSON.parse(text + decoder.decode());
    const old = legacy.safeParse(report);
    const batch = modern.safeParse(report);
    if (old.success)
      log("warn", "csp_violation", {
        directive: old.data["csp-report"]["effective-directive"],
      });
    else if (batch.success) {
      const directives = [
        ...new Set(batch.data.map((item) => item.body.effectiveDirective)),
      ];
      log("warn", "csp_violation", { directives });
    }
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
