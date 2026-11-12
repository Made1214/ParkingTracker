import { expect, test } from "@playwright/test";
import { login, seed } from "./helpers";

test("el registro explica qué le falta a una contraseña débil", async ({
  page,
}) => {
  await page.goto("/register");
  await expect(
    page.getByText("10 o más caracteres, con letras y números."),
  ).toBeVisible();
  await page.getByLabel("Tu nombre").fill("Prueba débil");
  await page
    .getByLabel("Correo electrónico")
    .fill(`e2e-debil-${Date.now()}@example.com`);
  await page.getByLabel("Contraseña").fill("sololetraslargas");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText(
    "A tu contraseña le falta un número.",
  );
});

test("las cuentas anteriores entran con su contraseña de siempre", async ({
  page,
}) => {
  // devpassword no cumple la regla nueva (no tiene números): el login debe
  // seguir aceptándola.
  await login(page, seed.member.email);
  await expect(page).toHaveURL(/\/groups$/);
});
