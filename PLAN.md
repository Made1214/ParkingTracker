# PLAN.md

Fuente de verdad del proyecto. Producto: [PRD](docs/01-PRD-Parking-Tracker.md). Decisiones técnicas: [OpenSpec](openspec/changes/define-stack/design.md). Reglas de trabajo: [RULES.md](RULES.md).

## Decisiones

- Next.js (App Router) + Supabase (Postgres, Auth, RLS). Gestor de paquetes: **pnpm**.
- Esquema mediante migraciones SQL inmutables (`supabase/migrations`). Sin Drizzle.
- Cada grupo es un tenant; RLS es la autoridad de autorización. Solo clave pública + JWT del usuario en la app; nunca clave de servicio.
- Estructura: `src/app` (rutas delgadas), `src/features/<modulo>` (API pública en `index.ts`), `src/shared` (UI, utilidades, clientes Supabase).
- Sistema visual **Noche serena** (paleta Lavanda claro/oscuro, Manrope + Instrument Serif, acento jade): tokens compartidos de color, espaciado, tipografía, radios y sombras; ver [design-system.md](docs/design-system.md).
- Desarrollo **por módulos**, en la rama de trabajo `made` y con un PR por módulo hacia `main`.
- Votaciones: cierre programado opcional; sin fecha cierran manualmente o al terminar el evento. Los porcentajes se calculan sobre opciones votadas (también en selección múltiple), y los empates se indican explícitamente. El organizador o administrador revisa propuestas; su conversión en actividades se completa con el módulo cronograma.
- Grupos: ajustes de nombre, descripción e imagen; roles, expulsión, salida y renovación de invitación. La base de datos serializa salidas/degradaciones para conservar al menos un administrador y exige membresía vigente también en borrados directos de contenido previamente creado.
- Perfil y recuperación: rutas `/profile`, `/forgot-password` y `/reset-password`; recuperación PKCE mediante `/auth/callback`. Los nombres de usuario se guardan en minúsculas, son únicos y admiten de 3 a 24 letras, números o guiones bajos. Los avatares personalizados usan Cloudinary privado, con lectura limitada al usuario y a personas con grupos en común.
- Gestión de eventos: edición/cancelación antes del inicio, borradores visibles al grupo, portada privada de hasta 5 MB (JPG/PNG/WebP, normalizada por Cloudinary) y cierre automático al terminar. Las mutaciones de tareas, propuestas y votaciones verifican también la hora de fin, sin depender del siguiente ciclo del cron.
- Las portadas se solicitan a una ruta que revalida membresía mediante RLS y transmite la imagen sin caché compartida. El servidor firma una URL de Cloudinary válida por 60 segundos; no entrega esa URL al cliente. Añadir portada es un paso posterior a guardar el evento.

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
| 10  | Gestión de salidas, perfil, recuperación de contraseña y gestión del grupo | `made`                | Integrado en `made`; aplicado en Staging |
| 11  | Cronograma (US-05)                                                         | `made`                | Hecho; migración aplicada en Staging     |
| 12  | Gastos (US-07)                                                             | `made`                | Hecho; migración aplicada en Staging     |
| 13  | Comentarios, galería (Cloudinary), historial y estadísticas, Realtime, PWA | `made`                | Pendiente                                |

## Notas

- Desde la fase 9 el trabajo nuevo se hace en la rama única `made`, con un PR por módulo hacia `main`.
- Los commits del agente se firman con una llave SSH de firma registrada en la cuenta de la dueña (GitHub los muestra como verificados); la llave vive solo en la sesión en la nube y se renueva en cada sesión. Los commits por API no quedan firmados. Al fusionar en `main` se usa "Squash and merge".
- Staging (verificado el 8 nov 2026) tiene `000`–`026`, `20261105052540_secure_task_access_guards` y nueve migraciones de `feat/poll-alignment` (`20261105120000` a `20261105163000`), integradas en `made` el 8 nov 2026; el cron de cierre de eventos corre cada minuto. Producción no recibió estos cambios.
- Las migraciones con prefijo de fecha no siguen la regla `NNN_` de [CLAUDE.md](CLAUDE.md). Ya están aplicadas en Staging, así que no se renombran. Como `027_` se ordenaría antes que ellas en una base nueva, las siguientes usan la versión con fecha que registra Staging al aplicarlas (p. ej. `20261109032108_schedule_management.sql`).
- Cronograma: solo quien organiza la salida o un admin gestiona actividades, dentro del horario de la salida y mientras siga abierta; las propuestas aceptadas se agendan una sola vez (`schedule_items.proposal_id`). Verificado en Staging con una prueba transaccional (11/11) y advisors sin hallazgos nuevos.
- Gastos: `create_expense` registra gasto y partes juntos; un trigger diferido exige que las partes sumen el total, y pagador y participantes deben ser del grupo. Saldos y deudas se calculan por salida (`get_event_balances`, `get_event_debts`, compensando deudas mutuas) y `settle_event_debt` salda una pareja (deudor, acreedor o admin). Verificado en Staging (12/12). El advisor marca `settle_event_debt` como `SECURITY DEFINER` ejecutable: es intencional y valida la autorización dentro de la función.
- Producción estaba pausada en la última revisión; su historial no se pudo verificar. Confirmarlo antes de promover migraciones.
- Advisors de Staging: la política `activity_proposals_insert` reevalúa `auth.uid()` por fila (usar `(select auth.uid())`), la protección de contraseñas filtradas de Auth está desactivada y hay claves foráneas compuestas sin índice (informativo). Las funciones `SECURITY DEFINER` señaladas son las RPC previstas del diseño.
- El CI (`.github/workflows/ci.yml`) ejecuta typecheck, lint, test, format y build, y aplica todas las migraciones con el seed para correr la suite pgTAP en cada PR.
- Las pruebas de medios con Cloudinary real requieren configurar las tres variables de `.env.example`; no hay credenciales de medios en el entorno local. Las pruebas automatizadas cubren autorización, aislamiento de referencias y entrega mediante un proveedor simulado.
