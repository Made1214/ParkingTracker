# Contribuir a Parking Tracker

Guía rápida para empezar. Las reglas completas están en:

- [RULES.md](RULES.md): flujo de Git, ramas, commits y PR (títulos y descripciones en inglés).
- [CLAUDE.md](CLAUDE.md): migraciones, autoría de commits y medios (Cloudinary).
- [AGENTS.md](AGENTS.md) y [PLAN.md](PLAN.md): contexto y estado del proyecto.
- [docs/design-system.md](docs/design-system.md): sistema visual Noche serena.

## Primer arranque

1. `pnpm install` (instala también el hook de pre-commit).
2. Con Docker abierto: `pnpm db:start`, y copia la URL y la clave anónima de `pnpm exec supabase status` a `.env.local` (guíate por `.env.example`).
3. `pnpm dev` y entra con un usuario del seed (`ana@example.com` / `devpassword`).

## Antes de abrir un PR

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:coverage
```

Si tocaste la base de datos, también `pnpm db:test`; si tocaste pantallas, `pnpm build && pnpm test:e2e` (incluye axe en claro y oscuro).

## Lo que revisa el pre-commit

Husky ejecuta `lint-staged` sobre los archivos preparados: ESLint (sin avisos) y Prettier. Si falla, corrige y vuelve a preparar los archivos.

## Reglas que ESLint hace cumplir

- Cada módulo de `src/features/<modulo>` se importa por su `index.ts` (`@/features/<modulo>`), nunca por sus carpetas internas.
- `next/image` no se usa en galería ni en estadísticas: las fotos llegan firmadas desde el servidor.

## Base de datos

- Cada cambio de esquema es una migración nueva en `supabase/migrations/`; nunca se edita una aplicada.
- Las funciones `SECURITY DEFINER` se documentan en `supabase/SECURITY_DEFINER.md` y llevan prueba pgTAP.
- Tras aplicar migraciones, regenera los tipos con `pnpm gen:types` (local) o `pnpm gen:types:staging` (requiere `supabase login`).
