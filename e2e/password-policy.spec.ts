import { expect, test } from "@playwright/test";
import { login, register, seed } from "./helpers";

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
  await page.getByLabel("Contraseña", { exact: true }).fill("sololetraslargas");
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

test("la contraseña se puede mostrar y vuelve a ocultarse al enviar", async ({
  page,
}) => {
  await page.goto("/login");
  const field = page.getByLabel("Contraseña", { exact: true });
  await field.fill("devpassword");
  await expect(field).toHaveAttribute("type", "password");

  const toggle = page.getByRole("button", { name: "Mostrar contraseña" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(field).toHaveAttribute("type", "text");
  await expect(field).toHaveValue("devpassword");
  await expect(
    page.getByRole("button", { name: "Ocultar contraseña" }),
  ).toHaveAttribute("aria-pressed", "true");

  // Al enviar vuelve a ocultarse, aunque el login falle.
  await page.getByLabel("Correo electrónico").fill("nadie@example.com");
  await page.getByRole("button", { name: "Entrar a mis planes" }).click();
  await expect(field).toHaveAttribute("type", "password");
});

test("se puede cambiar la contraseña desde el perfil pidiendo la actual", async ({
  page,
}) => {
  // Cuenta propia: cambiar la contraseña de un usuario del seed rompería el resto.
  await register(page);
  await page.goto("/profile");
  await page.getByText("Cambiar contraseña", { exact: true }).first().click();
  const current = page.getByLabel("Contraseña actual", { exact: true });
  const next = page.getByLabel("Contraseña nueva", { exact: true });
  const repeat = page.getByLabel("Repite la contraseña nueva", { exact: true });

  await current.fill("no-es-la-actual1");
  await next.fill("otraclave2026");
  await repeat.fill("otraclave2026");
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText(
    "La contraseña actual no es correcta.",
  );

  // React 19 vacía todos los campos del formulario al terminar la acción, aunque
  // haya fallado: hay que volver a llenarlos, o el navegador bloquea el envío
  // por los campos obligatorios vacíos.
  await current.fill(seed.newPassword);
  await next.fill("otraclave2026");
  await repeat.fill("otraclave2026");
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page.locator("p[role=status]").first()).toHaveText(
    "Tu contraseña se actualizó.",
  );
});
