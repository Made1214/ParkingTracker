import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestError } from "./instrumentation";

describe("onRequestError", () => {
  afterEach(() => vi.restoreAllMocks());

  it("registra una línea JSON con request_id y sin la query", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("boom"), { digest: "123" });
    await onRequestError(
      error,
      {
        path: "/invite/abc?token=secreto",
        method: "POST",
        headers: { "x-request-id": "req_0123456789ab" },
      },
      {
        routerKind: "App Router",
        routePath: "/invite/[code]",
        routeType: "action",
        revalidateReason: undefined,
      },
    );
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({
      level: "error",
      message: "request_error",
      request_id: "req_0123456789ab",
      method: "POST",
      path: "/invite/abc",
      route: "/invite/[code]",
      route_type: "action",
      error: { name: "Error", message: "boom", digest: "123" },
    });
    expect(spy.mock.calls[0][0]).not.toContain("secreto");
  });
});
