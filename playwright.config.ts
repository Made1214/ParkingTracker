import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
// Para usar un Chromium ya instalado en lugar del que descarga Playwright.
const executablePath = process.env.E2E_CHROMIUM_PATH;

/**
 * Pruebas E2E contra la app ya compilada (`pnpm build`) y una base con el seed
 * (`supabase/seed.sql`): en CI, el Supabase local; ver README.
 */
export default defineConfig({
  testDir: "e2e",
  // Las pruebas comparten los usuarios y el grupo del seed.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: "es-PA",
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm start",
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
