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
  await reader.goto(eventPath);
  await expect(
    reader.getByRole("heading", { name: "Comentarios" }),
  ).toBeVisible();

  await subscribed;

  const writer = await newSession(browser);
  await login(writer, seed.member.email, eventPath);

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
