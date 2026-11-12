import { expect, test } from "@playwright/test";
import { groupUrl, login, register, seed, upcomingEventPath } from "./helpers";

test("enlace de invitación → unirse → confirmar asistencia", async ({
  page,
}) => {
  // El enlace se abre sin sesión: debe volver a la invitación tras registrarse.
  const invite = `/join/${seed.inviteCode}`;
  await page.goto(invite);
  await page.waitForURL((url) => url.pathname === "/login");
  const name = await register(page, invite);

  // Antes de aceptar se ve a qué grupo se entra (E3.F2.T1), y nada obliga a
  // instalar la app (PWA, US-02).
  await expect(
    page.getByRole("heading", { name: seed.groupName, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/\d+ miembros?/)).toBeVisible();
  await page
    .getByRole("button", { name: `Unirme a ${seed.groupName}` })
    .click();
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

test("un código que no existe deja escribir otro", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/join/NOEXISTE");
  await page.waitForURL((url) => url.pathname === "/login");
  await register(page, "/join/NOEXISTE");
  await expect(
    page.getByText("No encontramos un grupo con ese enlace", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Código de invitación")).toHaveValue("NOEXISTE");
});

test("quien ya es miembro va directo a su grupo", async ({ page }) => {
  await login(page, seed.member.email, `/join/${seed.inviteCode}`);
  await expect(
    page.getByRole("heading", { name: `Ya eres parte de ${seed.groupName}.` }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ir al grupo" }).click();
  await page.waitForURL((url) => url.pathname === groupUrl);
});
