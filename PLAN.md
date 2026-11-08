# PLAN.md

Fuente de verdad del proyecto. Producto: [PRD](docs/01-PRD-Parking-Tracker.md). Decisiones técnicas: [OpenSpec](openspec/changes/define-stack/design.md). Reglas de trabajo: [RULES.md](RULES.md).

## Decisiones

- Next.js (App Router) + Supabase (Postgres, Auth, RLS). Gestor de paquetes: **pnpm**.
- Esquema mediante migraciones SQL inmutables (`supabase/migrations`). Sin Drizzle.
- Cada grupo es un tenant; RLS es la autoridad de autorización. Solo clave pública + JWT del usuario en la app; nunca clave de servicio.
- Estructura: `src/app` (rutas delgadas), `src/features/<modulo>` (API pública en `index.ts`), `src/shared` (UI, utilidades, clientes Supabase).
- Sistema visual **Noche serena** (paleta Lavanda claro/oscuro, Manrope + Instrument Serif, acento jade): tokens compartidos de color, espaciado, tipografía, radios y sombras; ver [design-system.md](docs/design-system.md).
- Desarrollo **por módulos**, en la rama de trabajo `made` y con un PR por módulo hacia `main`.

## Fases

| #   | Fase                                                                       | Rama                  | Estado                                   |
| --- | -------------------------------------------------------------------------- | --------------------- | ---------------------------------------- |
| 0   | Base de datos (migraciones 000–023, RLS, pgTAP)                            | — (en `main`)         | Hecho                                    |
| 1   | Scaffold de la app (tooling, shell)                                        | `chore/scaffold-base` | Hecho                                    |
| 2   | Módulo login (registro, sesión, Google)                                    | `feat/auth-login`     | Hecho                                    |
| 3   | Módulo grupos (crear, invitar, unirse)                                     | `feat/groups`         | Hecho                                    |
| 4   | Módulo eventos + RSVP                                                      | `feat/events-rsvp`    | Hecho                                    |
| 5   | Migraciones 024 (agregados de gastos) y 025 (cierre de RSVP)               | `feat/db-024-025`     | En `main`; aplicadas en Staging          |
| 6   | CI (checks + pgTAP) y pruebas E2E (Playwright)                             | `made`                | CI listo; E2E pendiente                  |
| 7   | Propuestas y votaciones (US-06, migración 026)                             | `feat/proposals`      | Hecho; 026 aplicada en Staging           |
| 8   | Tareas (RF-800)                                                            | `feat/tasks`          | Hecho                                    |
| 9   | Diseño Noche serena y marca                                                | `made`                | Hecho / en revisión                      |
| 10  | Gestión de salidas, perfil, recuperación de contraseña y gestión del grupo | `feat/poll-alignment` | En rama, aplicado en Staging, sin fusión |
| 11  | Cronograma (US-05)                                                         | `made`                | Pendiente                                |
| 12  | Gastos (US-07)                                                             | `made`                | Pendiente                                |
| 13  | Comentarios, galería (Cloudinary), historial y estadísticas, Realtime, PWA | `made`                | Pendiente                                |

## Notas

- Desde la fase 9 el trabajo nuevo se hace en la rama única `made`, con un PR por módulo hacia `main`.
- Staging (verificado el 8 nov 2026) tiene `000`–`026`, `20261105052540_secure_task_access_guards` y nueve migraciones de `feat/poll-alignment` (`20261105120000` a `20261105163000`). Esas nueve no están en `main`.
- Las migraciones con prefijo de fecha no siguen la regla `NNN_` de [CLAUDE.md](CLAUDE.md). Ya están aplicadas en Staging, así que no se renombran; antes de crear la siguiente migración hay que acordar si se continúa con `027_` o con prefijo de fecha.
- Producción estaba pausada en la última revisión; su historial no se pudo verificar. Confirmarlo antes de promover migraciones.
- Advisors de Staging: la política `activity_proposals_insert` reevalúa `auth.uid()` por fila (usar `(select auth.uid())`), la protección de contraseñas filtradas de Auth está desactivada y hay claves foráneas compuestas sin índice (informativo). Las funciones `SECURITY DEFINER` señaladas son las RPC previstas del diseño.
- El CI (`.github/workflows/ci.yml`) ejecuta typecheck, lint, test, format y build, y aplica todas las migraciones con el seed para correr la suite pgTAP en cada PR.
