import { expect, test } from "@playwright/test";

test("expone la sonda y el receptor de reportes sin sesión", async ({
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", db: "ok" });
  const report = await request.post("/api/csp-report", {
    headers: { "Content-Type": "application/csp-report" },
    data: { "csp-report": { "effective-directive": "script-src" } },
  });
  expect(report.status()).toBe(204);
});

test("la política y los scripts del documento usan un nonce nuevo por petición", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.CSP_MODE !== "enforce",
    "Requiere compilar con CSP_MODE=enforce.",
  );
  const first = await page.goto("/login");
  const second = await request.get("/login");
  const nonce = (policy: string | undefined) =>
    /'nonce-([^']+)'/.exec(policy ?? "")?.[1];
  const current = nonce(first?.headers()["content-security-policy"]);
  expect(current).toBeTruthy();
  expect(nonce(second.headers()["content-security-policy"])).not.toBe(current);
  expect(
    await page
      .locator("script[nonce]")
      .first()
      .evaluate((script) => (script as HTMLScriptElement).nonce),
  ).toBe(current);
});
