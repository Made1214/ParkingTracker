# RULES.md

Reglas de trabajo del proyecto. Aplican a personas y agentes. Complementan [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md) (migraciones) y [PLAN.md](PLAN.md) (fuente de verdad del proyecto).

## Flujo de Git

1. Antes de escribir, leer `RULES.md` y `AGENTS.md`; `PLAN.md` es la fuente de verdad del proyecto.
2. No trabajar ni hacer commits directamente en `main`. Crear o continuar una rama `tipo/descripcion-corta` en kebab-case; por ejemplo `feat/…`, `fix/…`, `docs/…`.
3. Mantener los cambios relacionados en commits lógicos. Usar Conventional Commits **en inglés** para el título, por ejemplo `feat(home): improve the home screen`. Tipos permitidos: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`. Todo commit lleva además una descripción (ver [Descripciones](#descripciones)).
4. Antes de terminar, ejecutar `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm format:check`.
5. Publicar la rama y abrir o actualizar un PR dirigido a `main`, con su descripción (ver [Descripciones](#descripciones)). El dueño revisa y fusiona el PR.
6. No editar migraciones existentes: cada cambio de esquema es un archivo SQL nuevo en `supabase/migrations/` (ver [CLAUDE.md](CLAUDE.md)).
7. Actualizar `PLAN.md` cuando se complete una fase o haya decisiones nuevas.

## Descripciones

Los títulos y las descripciones de commits y PR se escriben **en inglés**. Esta documentación sigue en español.

### Commits

El título va seguido de un cuerpo **siempre obligatorio**, separado por una línea en blanco. El cuerpo es una lista de viñetas que explica qué cambia y por qué:

```text
feat(auth): add email sign-in

- Add the login form and the `login` server action using Supabase Auth.
- Validate credentials with zod so invalid input never reaches Supabase.
- Redirect to the requested page only if it is a safe internal path.
```

- Cada viñeta describe un cambio concreto y, cuando no es evidente, la razón.
- No basta con repetir el título ni con listar archivos.

### Pull requests

Todo PR usa la plantilla de [`.github/pull_request_template.md`](.github/pull_request_template.md), que GitHub rellena al abrirlo. Secciones:

- **Summary:** qué hace el PR y por qué.
- **Changes:** lista de cambios.
- **How to test:** pasos para comprobarlo.
- **Notes:** decisiones, riesgos o dependencias con otros PR.
- **Checklist:** `typecheck`, `lint`, `test`, `format:check` y `PLAN.md` actualizado si aplica.

Un PR que depende de otro lo indica en **Notes** y apunta a la rama del PR anterior hasta que este se fusione.

## Trabajo por módulos

- Se avanza **un módulo a la vez** (login, grupos, eventos, …), cada uno en su propia rama y PR.
- No se adelanta código de módulos futuros, aunque el esquema de base de datos ya exista.
- Cada módulo vive en `src/features/<modulo>` y expone su API pública solo mediante `index.ts`.

## Stack y comandos

El proyecto usa **pnpm** y **migraciones SQL de Supabase** (sin Drizzle).

| Acción      | Comando             |
| ----------- | ------------------- |
| Tipos       | `pnpm typecheck`    |
| Lint        | `pnpm lint`         |
| Tests       | `pnpm test`         |
| Formato     | `pnpm format:check` |
| Tests de BD | `pnpm db:test`      |
| Build       | `pnpm build`        |
