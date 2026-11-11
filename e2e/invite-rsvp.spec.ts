import { expect, test } from "@playwright/test";
import { groupUrl, register, seed, upcomingEventPath } from "./helpers";

test("enlace de invitación → unirse → confirmar asistencia", async ({
  page,
}) => {
  // El enlace se abre sin sesión: debe volver a la invitación tras registrarse.
  const invite = `/join/${seed.inviteCode}`;
  await page.goto(invite);
  await page.waitForURL((url) => url.pathname === "/login");
  const name = await register(page, invite);

  // Nada obliga a instalar la app antes de aceptar (PWA, US-02).
  await expect(
    page.getByRole("heading", { name: "Súmate al plan." }),
  ).toBeVisible();
  await expect(page.getByLabel("Código de invitación")).toHaveValue(
    seed.inviteCode,
  );
  await page.getByRole("button", { name: "Aceptar invitación" }).click();
  await page.waitForURL((url) => url.pathname === groupUrl);
  await expect(
    page.getByRole("heading", { name: seed.groupName, level: 1 }),
  ).toBeVisible();

  await page.goto(await upcomingEventPath(page));
  const going = page.getByRole("button", { name: "Voy", exact: true });
  await going.click();
  await expect(going).toHaveAttribute("aria-pressed", "true");

  // La respuesta se guardó en el servidor, no solo en pantalla.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Voy", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(name).first()).toBeVisible();
});
