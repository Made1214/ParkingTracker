import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Lógica de negocio (RNF-10): acciones, consultas y utilidades compartidas.
      // Los componentes de React se cubren con las pruebas E2E.
      include: ["src/features/*/api/**/*.ts", "src/shared/lib/**/*.ts"],
      exclude: ["**/*.test.ts"],
      reporter: ["text-summary", "text", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        // Meta general del SRS: ≥ 60 % en lógica de negocio.
        lines: 60,
        statements: 60,
        // ≥ 80 % en gastos y votaciones.
        "src/features/expenses/api/**": { lines: 80, statements: 80 },
        "src/features/proposals/api/**": { lines: 80, statements: 80 },
      },
    },
  },
});
