import { expect, test } from "@playwright/test";
import {
  groupUrl,
  login,
  newSession,
  register,
  seed,
  upcomingEventPath,
} from "./helpers";

test("alguien ajeno al grupo no ve sus salidas ni por URL directa", async ({
  browser,
}) => {
  const member = await newSession(browser);
  await login(member, seed.member.email);
  const eventPath = await upcomingEventPath(member);
  await member.goto(eventPath);
  const title = await member.getByRole("heading", { level: 1 }).innerText();

  const outsider = await newSession(browser);
  await register(outsider);

  for (const path of [
    eventPath,
    groupUrl,
    `${groupUrl}/stats`,
    `${groupUrl}/settings`,
  ]) {
    await outsider.goto(path);
    await expect(
      outsider.getByRole("heading", { name: "No encontramos este plan." }),
      `${path} no debe ser visible para alguien ajeno`,
    ).toBeVisible();
    await expect(outsider.getByText(title)).toHaveCount(0);
    await expect(outsider.getByText(seed.groupName)).toHaveCount(0);
  }
});
