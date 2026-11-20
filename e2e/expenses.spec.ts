import { expect, test } from "@playwright/test";
import { login, seed, upcomingEventPath } from "./helpers";

test("registra dos gastos seguidos y permite retirarlos", async ({ page }) => {
  await login(page, seed.admin.email);
  await page.goto(`${await upcomingEventPath(page)}?section=gastos`);
  const description = page.getByLabel("Descripción", { exact: true });
  const amount = page.getByLabel("Monto (USD)", { exact: true });
  const stamp = Date.now();

  for (const name of [`Hielo ${stamp}`, `Carbón ${stamp}`]) {
    await description.fill(name);
    await amount.fill("19.00");
    await page.getByRole("button", { name: "Guardar gasto" }).click();
    const expense = page.getByRole("listitem").filter({ hasText: name });
    await expect(expense).toBeVisible();
    await expect(expense).toContainText("19.00");
    await expense.getByLabel(`Opciones de ${name}`).click();
    await expense.getByRole("button", { name: "Eliminar gasto" }).click();
    await expect(expense).toHaveCount(0);
  }
});
