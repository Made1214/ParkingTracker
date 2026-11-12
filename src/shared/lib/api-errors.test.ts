import { describe, expect, it } from "vitest";
import { apiError, newRequestId } from "./api-errors";

describe("apiError", () => {
  it("devuelve el formato uniforme con request_id", async () => {
    const response = apiError("NOT_FOUND", { requestId: "req_abc123abc123" });
    expect(response.status).toBe(404);
    expect(response.headers.get("X-Request-Id")).toBe("req_abc123abc123");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "No encontramos lo que buscas.",
        request_id: "req_abc123abc123",
      },
    });
  });

  it("incluye detalles por campo y respeta el mensaje propio", async () => {
    const response = apiError("VALIDATION_ERROR", {
      requestId: "req_1",
      message: "El título es obligatorio.",
      details: [{ field: "title", issue: "required" }],
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toBe("El título es obligatorio.");
    expect(body.error.details).toEqual([{ field: "title", issue: "required" }]);
  });

  it("nunca deja un error en caché aunque la ruta pase cabeceras de caché", () => {
    const response = apiError("UPSTREAM_ERROR", {
      requestId: "req_1",
      headers: { "Cache-Control": "private, max-age=600", "Retry-After": "5" },
    });
    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Retry-After")).toBe("5");
  });

  it("genera ids con prefijo req_", () => {
    expect(newRequestId()).toMatch(/^req_[0-9a-f]{12}$/);
    expect(newRequestId()).not.toBe(newRequestId());
  });
});
