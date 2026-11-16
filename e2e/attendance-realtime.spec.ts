import { expect, test } from "@playwright/test";
import {
  login,
  newSession,
  realtimeSubscribed,
  seed,
  upcomingEventPath,
} from "./helpers";

test("la respuesta de asistencia de otra persona aparece en vivo", async ({
  browser,
}) => {
  const reader = await newSession(browser);
  await login(reader, seed.admin.email);
  const eventPath = await upcomingEventPath(reader);
  const subscribed = realtimeSubscribed(reader);
  await reader.goto(eventPath);
  await expect(
    reader.getByRole("heading", { name: "Asistencia" }),
  ).toBeVisible();
  await subscribed;

  const responder = await newSession(browser);
  await login(responder, seed.member.email, eventPath);

  // Dos cambios seguidos: aunque Luis ya tuviera una respuesta, al menos uno
  // es un cambio real. Muy por debajo del sondeo de 30 s: solo pasa si llega
  // el aviso de Realtime.
  for (const [button, status] of [
    ["Quizás", "maybe"],
    ["Voy", "going"],
  ] as const) {
    await responder.getByRole("button", { name: button, exact: true }).click();
    await expect(
      responder.locator(`dl div[data-status="${status}"]`),
    ).toContainText("Tú");
    await expect(
      reader.locator(`dl div[data-status="${status}"]`),
    ).toContainText(seed.member.name, { timeout: 15_000 });
  }
});
