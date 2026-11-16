import { expect, test } from "@playwright/test";
import {
  login,
  newSession,
  realtimeSubscribed,
  seed,
  upcomingEventPath,
} from "./helpers";

test("un comentario aparece y desaparece en vivo para otra persona", async ({
  browser,
}) => {
  const reader = await newSession(browser);
  await login(reader, seed.admin.email);
  const eventPath = await upcomingEventPath(reader);
  const subscribed = realtimeSubscribed(reader);
  await reader.goto(`${eventPath}?section=comentarios`);
  await expect(
    reader.getByRole("heading", { name: "Comentarios" }),
  ).toBeVisible();

  await subscribed;

  const writer = await newSession(browser);
  await login(writer, seed.member.email, eventPath);
  await writer.goto(`${eventPath}?section=comentarios`);

  const body = `Comentario E2E ${Date.now()}`;
  await writer.getByLabel("Escribe un comentario").fill(body);
  await writer.getByRole("button", { name: "Enviar" }).click();
  const written = writer.locator("article", { hasText: body });
  await expect(written).toBeVisible();

  // Muy por debajo del sondeo de 30 s: solo pasa si llega el aviso de Realtime.
  const received = reader.locator("article", { hasText: body });
  await expect(received).toBeVisible({ timeout: 15_000 });

  await written.getByText("Eliminar", { exact: true }).click();
  await written.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(written).toHaveCount(0);
  await expect(received).toHaveCount(0, { timeout: 15_000 });
});

test("la pestaña Comentarios cuenta los nuevos y se limpia al abrirla", async ({
  browser,
}) => {
  const reader = await newSession(browser);
  await login(reader, seed.admin.email);
  const eventPath = await upcomingEventPath(reader);
  const subscribed = realtimeSubscribed(reader);
  // El lector está en otra pestaña: solo la insignia puede avisarle.
  await reader.goto(eventPath);
  await subscribed;

  const writer = await newSession(browser);
  await login(writer, seed.member.email, eventPath);
  await writer.goto(`${eventPath}?section=comentarios`);
  const body = `Insignia E2E ${Date.now()}`;
  await writer.getByLabel("Escribe un comentario").fill(body);
  await writer.getByRole("button", { name: "Enviar" }).click();
  const written = writer.locator("article", { hasText: body });
  await expect(written).toBeVisible();

  const tab = reader
    .getByRole("navigation", { name: "Secciones de la salida" })
    .getByRole("link", { name: /Comentarios/ });
  await expect(tab).toContainText("1 comentarios nuevos", { timeout: 15_000 });

  await tab.click();
  await expect(reader.locator("article", { hasText: body })).toBeVisible();
  await expect(tab).not.toContainText("comentarios nuevos");

  await written.getByText("Eliminar", { exact: true }).click();
  await written.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(written).toHaveCount(0);
});
