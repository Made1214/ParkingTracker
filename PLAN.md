# PLAN.md

Fuente de verdad del proyecto. Producto: [PRD](docs/01-PRD-Parking-Tracker.md). Decisiones técnicas: [OpenSpec](openspec/changes/define-stack/design.md). Reglas de trabajo: [RULES.md](RULES.md).

## Decisiones

- Next.js (App Router) + Supabase (Postgres, Auth, RLS). Gestor de paquetes: **pnpm**.
- Esquema mediante migraciones SQL inmutables (`supabase/migrations`). Sin Drizzle.
- Cada grupo es un tenant; RLS es la autoridad de autorización. Solo clave pública + JWT del usuario en la app; nunca clave de servicio.
- Estructura: `src/app` (rutas delgadas), `src/features/<modulo>` (API pública en `index.ts`), `src/shared` (UI, utilidades, clientes Supabase).
- Desarrollo **por módulos**, una rama y un PR por módulo.

## Fases

| #   | Fase                                                                                     | Rama                  | Estado      |
| --- | ---------------------------------------------------------------------------------------- | --------------------- | ----------- |
| 0   | Base de datos (migraciones 000–023, RLS, pgTAP)                                          | — (en `main`)         | Hecho       |
| 1   | Scaffold de la app (tooling, shell)                                                      | `chore/scaffold-base` | Hecho       |
| 2   | Módulo login (registro, sesión, Google)                                                  | `feat/auth-login`     | En revisión |
| 3   | Módulo grupos (crear, invitar, unirse)                                                   | `feat/groups`         | Pendiente   |
| 4   | Módulo eventos + RSVP                                                                    | `feat/events-rsvp`    | Pendiente   |
| 5   | Migraciones 024 (agregados de gastos) y 025 (cierre de RSVP)                             | `feat/db-024-025`     | Pendiente   |
| 6   | CI y pruebas E2E (Playwright)                                                            | `chore/ci-e2e`        | Pendiente   |
| 7   | Resto de módulos del PRD (propuestas, gastos, tareas, galería, historial, Realtime, PWA) | —                     | Pendiente   |

## Notas

- Las migraciones `024` y `025` están escritas pero aún no se han verificado en Staging ni desplegado.
- Producción contiene `000`–`023`. Verificar el historial remoto antes de promover nuevas migraciones.
