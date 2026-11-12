import { expect, test } from "@playwright/test";
import {
  login,
  newSession,
  realtimeSubscribed,
  seed,
  upcomingEventPath,
} from "./helpers";

test("RF-504: un voto se ve en vivo en la sesión de otra persona", async ({
  browser,
}) => {
  const voter = await newSession(browser);
  await login(voter, seed.admin.email);
  const pollsPath = `${await upcomingEventPath(voter)}?section=votaciones`;
  await voter.goto(pollsPath);

  // Una votación nueva y única, para no depender del estado del seed.
  const question = `¿Votación E2E ${Date.now()}?`;
  await voter.getByLabel("¿Qué quieren decidir?").fill(question);
  await voter.getByLabel("Opción 1", { exact: true }).fill("Playa");
  await voter.getByLabel("Opción 2", { exact: true }).fill("Montaña");
  await voter.getByRole("button", { name: "Publicar votación" }).click();
  const mine = voter.locator("section", {
    has: voter.getByRole("heading", { name: question }),
  });
  await expect(mine).toBeVisible();

  // La otra persona abre la misma pantalla y espera la suscripción.
  const watcher = await newSession(browser);
  await login(watcher, seed.member.email);
  const subscribed = realtimeSubscribed(watcher);
  await watcher.goto(pollsPath);
  const watched = watcher.locator("section", {
    has: watcher.getByRole("heading", { name: question }),
  });
  await expect(watched).toContainText("0 votos emitidos");
  await subscribed;

  await mine.getByRole("radio", { name: /Playa/ }).check();
  await mine.getByRole("button", { name: "Guardar voto" }).click();
  await expect(mine).toContainText("1 voto emitido");

  // Muy por debajo de cualquier sondeo: solo pasa si llega el aviso.
  await expect(watched).toContainText("1 voto emitido", { timeout: 15_000 });
  await expect(watched.getByText("1 voto · 100%")).toBeVisible();
});
