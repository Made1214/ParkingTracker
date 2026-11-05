import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function createMember(page: Page, suffix: string) {
  await page.goto("/register");
  await page.getByLabel("Tu nombre").fill(`E2E ${suffix}`);
  await page
    .getByLabel("Correo electrónico")
    .fill(`e2e-${randomUUID()}@example.com`);
  await page.getByLabel("Contraseña").fill("test-password-123");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await page.getByLabel("Nombre del grupo").fill(`E2E group ${suffix}`);
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await expect(page).toHaveURL(/\/groups\/[\w-]+$/);
}

test("a member cannot open another group's event by direct URL", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  try {
    const owner = await ownerContext.newPage();
    const outsider = await outsiderContext.newPage();
    await createMember(owner, "owner");
    await owner.getByLabel("¿Qué van a hacer?").fill("E2E private event");
    await owner.getByLabel("Inicio · hora de Panamá").fill("2099-01-01T12:00");
    await owner.getByLabel("Fin · hora de Panamá").fill("2099-01-01T13:00");
    await owner.getByRole("button", { name: "Publicar evento" }).click();
    await expect(
      owner.getByRole("heading", { name: "E2E private event" }),
    ).toBeVisible();
    const eventUrl = owner.url();

    await createMember(outsider, "outsider");
    await outsider.goto(eventUrl);
    await expect(
      outsider.getByRole("heading", { name: "No encontramos este plan." }),
    ).toBeVisible();
    await expect(outsider.getByText("E2E private event")).toHaveCount(0);
  } finally {
    await ownerContext.close();
    await outsiderContext.close();
  }
});
