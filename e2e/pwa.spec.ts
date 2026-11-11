import { expect, test } from "@playwright/test";
import { login, seed, upcomingEventPath } from "./helpers";

test("el manifest declara una app instalable", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "Parking Tracker",
    display: "standalone",
    start_url: "/",
    lang: "es",
  });
  const sizes = manifest.icons.map(
    (icon: { sizes: string; purpose?: string }) =>
      `${icon.sizes}${icon.purpose ? ` ${icon.purpose}` : ""}`,
  );
  expect(sizes).toEqual(
    expect.arrayContaining(["192x192", "512x512", "512x512 maskable"]),
  );
  for (const icon of manifest.icons) {
    const image = await request.get(icon.src);
    expect(image.ok(), icon.src).toBe(true);
    expect(image.headers()["content-type"]).toBe("image/png");
  }
});

test("sin conexión se avisa, no se pierde lo escrito y hay pantalla propia", async ({
  page,
  context,
}) => {
  await login(page, seed.member.email);
  await page.goto(await upcomingEventPath(page));
  await page.evaluate(() => navigator.serviceWorker.ready);
  // La segunda carga ya pasa por el service worker.
  await page.reload();
  const composer = page.getByLabel("Escribe un comentario");
  await expect(composer).toBeVisible();

  await context.setOffline(true);
  await expect(
    page.getByText("Sin conexión. Lo que ves puede estar desactualizado."),
  ).toBeVisible();

  await composer.fill("Borrador sin conexión");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Sin conexión: no se envió nada.")).toBeVisible();
  await expect(composer).toHaveValue("Borrador sin conexión");

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Estás sin conexión" }),
  ).toBeVisible();

  // Nada privado quedó guardado: solo estáticos con hash y la pantalla offline.
  const cached = await page.evaluate(async () => {
    const paths: string[] = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys())
        paths.push(new URL(request.url).pathname);
    return paths;
  });
  expect(cached.length).toBeGreaterThan(0);
  for (const path of cached)
    expect(
      path.startsWith("/_next/static/") ||
        ["/offline.html", "/icons/icon-192.png"].includes(path),
      `${path} no debería estar en caché`,
    ).toBe(true);

  await context.setOffline(false);
  await expect(composer).toBeVisible();
});
