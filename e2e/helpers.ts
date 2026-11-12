import { expect, type Browser, type Page } from "@playwright/test";

/** Datos fijos de `supabase/seed.sql`. */
export const seed = {
  password: "devpassword",
  /** Cuentas nuevas: cumple la regla de 10+ caracteres con letras y números. */
  newPassword: "devpassword10",
  admin: { email: "ana@example.com", name: "Ana Torres" },
  member: { email: "luis@example.com", name: "Luis Fernández" },
  groupId: "10000000-0000-0000-0000-000000000001",
  groupName: "Los de siempre",
  inviteCode: "DEV00001",
};

export const groupUrl = `/groups/${seed.groupId}`;

/** Página nueva con sesión propia (cookies aisladas del resto). */
export async function newSession(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

export async function login(page: Page, email: string, next = "/groups") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(seed.password);
  await page.getByRole("button", { name: "Entrar a mis planes" }).click();
  await page.waitForURL((url) => url.pathname === next.split("?")[0]);
}

/** Registra a alguien nuevo, ajeno a cualquier grupo. Devuelve su nombre. */
export async function register(page: Page, next = "/groups") {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const name = `E2E ${id}`;
  await page.goto(`/register?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByLabel("Correo electrónico").fill(`e2e-${id}@example.com`);
  await page.getByLabel("Contraseña").fill(seed.newPassword);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await page.waitForURL((url) => url.pathname === next.split("?")[0]);
  return name;
}

/** Ruta de la primera salida publicada y aún por empezar del grupo del seed. */
export async function upcomingEventPath(page: Page) {
  await page.goto(groupUrl);
  const link = page
    .locator('a[href*="/events/"]')
    .filter({ hasText: "SE VIENE" })
    .first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  if (!href) throw new Error("La salida publicada no tiene enlace.");
  return href;
}

/**
 * Se resuelve cuando Realtime confirma la suscripción a cambios de Postgres.
 * Llamar antes de navegar: hasta ese aviso los cambios no se entregan.
 */
export function realtimeSubscribed(page: Page) {
  return new Promise<void>((resolve) => {
    page.on("websocket", (socket) => {
      socket.on("framereceived", (frame) => {
        if (String(frame.payload).includes("Subscribed to PostgreSQL"))
          resolve();
      });
    });
  });
}
