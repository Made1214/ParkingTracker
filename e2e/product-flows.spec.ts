import { expect, test } from "@playwright/test";
import { groupUrl, login, seed, upcomingEventPath } from "./helpers";

test("crea y elimina un borrador desde el detalle", async ({ page }) => {
  await login(page, seed.admin.email);
  await page.goto(`${groupUrl}#nueva-salida`);
  const title = `Borrador ${Date.now()}`;
  const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("¿Qué van a hacer?").fill(title);
  await page.getByLabel("Inicio · hora de Panamá").fill(`${date}T09:00`);
  await page.getByLabel("Fin · hora de Panamá").fill(`${date}T11:00`);
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByText("Eliminar borrador", { exact: true }).click();
  await page.getByRole("button", { name: "Confirmar eliminación" }).click();
  await page.waitForURL(`**${groupUrl}`);
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});

test("gestiona invitados sin abrir el lector de facturas", async ({ page }) => {
  await login(page, seed.admin.email);
  await page.goto(`${await upcomingEventPath(page)}?section=gastos`);
  await page.getByText("Invitados de la salida", { exact: true }).click();
  const name = `Invitado ${Date.now()}`;
  const add = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Añadir invitado" }) });
  await add.getByLabel("Nombre", { exact: true }).fill(name);
  await add.getByRole("button", { name: "Añadir invitado" }).click();
  await page.getByText(name, { exact: true }).click();
  const rename = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Guardar nombre" }) });
  await rename.getByLabel("Nombre", { exact: true }).fill(`${name} editado`);
  await rename.getByRole("button", { name: "Guardar nombre" }).click();
  await expect(
    page.getByText(`${name} editado`, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Eliminar invitado" }).click();
  await expect(page.getByText(`${name} editado`, { exact: true })).toHaveCount(
    0,
  );
});
