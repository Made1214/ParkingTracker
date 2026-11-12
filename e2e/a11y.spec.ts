import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { groupUrl, login, seed, upcomingEventPath } from "./helpers";

/**
 * Escaneo WCAG 2.1 AA con axe-core (incluye contraste de color) en las
 * pantallas principales, en modo claro y oscuro y en ancho de teléfono
 * (docs/06-UI-UX: el 80 % del uso será móvil).
 */
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectAccessible(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page })
    .withTags(tags)
    .analyze();
  const summary = violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
  }));
  expect(summary, `${name}: ${JSON.stringify(summary, null, 2)}`).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`accesibilidad · modo ${colorScheme === "light" ? "claro" : "oscuro"}`, () => {
    test.use({
      colorScheme,
      // Sin animaciones: axe mediría colores a medio fundido.
      reducedMotion: "reduce",
      viewport: { width: 390, height: 844 },
    });

    test("pantallas públicas", async ({ page }) => {
      for (const path of ["/login", "/register", "/forgot-password"]) {
        await page.goto(path);
        await expectAccessible(page, path);
      }
    });

    test("pantallas con sesión", async ({ page }) => {
      await login(page, seed.member.email);
      await expectAccessible(page, "/groups");
      await page.goto(groupUrl);
      await expectAccessible(page, groupUrl);
      await page.goto(`${groupUrl}/stats`);
      await expectAccessible(page, "stats");
      await page.goto("/profile");
      await expectAccessible(page, "/profile");
      const event = await upcomingEventPath(page);
      for (const section of [
        "plan",
        "votaciones",
        "gastos",
        "tareas",
        "fotos",
      ]) {
        await page.goto(`${event}?section=${section}`);
        await expectAccessible(page, `salida · ${section}`);
      }
    });
  });
}
