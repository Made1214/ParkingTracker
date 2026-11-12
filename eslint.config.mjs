import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Cada módulo de src/features expone su API pública en index.ts; los demás
// módulos y las rutas no entran a sus carpetas internas (define-stack PR 4).
const featureBoundary = {
  group: ["@/features/*/*"],
  message:
    "Importa desde el index del módulo (@/features/<modulo>), no desde sus carpetas internas.",
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [featureBoundary] }],
    },
  },
  {
    // Las fotos llegan ya firmadas y comprimidas por Cloudinary: next/image
    // las volvería a optimizar (CLAUDE.md, Media; define-stack PR 8).
    files: ["src/features/gallery/**", "src/features/stats/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [featureBoundary],
          paths: [
            {
              name: "next/image",
              message:
                "Usa <img> en galería e historial: las imágenes ya vienen firmadas desde el servidor.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);
