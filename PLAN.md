# PLAN.md

Fuente de verdad del proyecto. Producto: [PRD](docs/01-PRD-Parking-Tracker.md). Decisiones técnicas: [OpenSpec](openspec/changes/define-stack/design.md). Reglas de trabajo: [RULES.md](RULES.md).

## Decisiones

- Next.js (App Router) + Supabase (Postgres, Auth, RLS). Gestor de paquetes: **pnpm**.
- Esquema mediante migraciones SQL inmutables (`supabase/migrations`). Sin Drizzle.
- Cada grupo es un tenant; RLS es la autoridad de autorización. Solo clave pública + JWT del usuario en la app; nunca clave de servicio.
- Estructura: `src/app` (rutas delgadas), `src/features/<modulo>` (API pública en `index.ts`), `src/shared` (UI, utilidades, clientes Supabase).
- Sistema visual **Noche serena** (paleta Lavanda claro/oscuro, Manrope + Instrument Serif, acento jade): tokens compartidos de color, espaciado, tipografía, radios y sombras; ver [design-system.md](docs/design-system.md).
- Desarrollo **por módulos**, una rama y un PR por módulo.
- Votaciones: cierre programado opcional; sin fecha cierran manualmente o al terminar el evento. Los porcentajes se calculan sobre opciones votadas (también en selección múltiple), y los empates se indican explícitamente. El organizador o administrador revisa propuestas; su conversión en actividades se completa con el módulo cronograma.
- Grupos: ajustes de nombre, descripción e imagen; roles, expulsión, salida y renovación de invitación. La base de datos serializa salidas/degradaciones para conservar al menos un administrador y exige membresía vigente también en borrados directos de contenido previamente creado.
- Perfil y recuperación: rutas `/profile`, `/forgot-password` y `/reset-password`; recuperación PKCE mediante `/auth/callback`. Los nombres de usuario se guardan en minúsculas, son únicos y admiten de 3 a 24 letras, números o guiones bajos. Los avatares personalizados usan Cloudinary privado, con lectura limitada al usuario y a personas con grupos en común.
- Gestión de eventos: edición/cancelación antes del inicio, borradores visibles al grupo, portada privada de hasta 5 MB (JPG/PNG/WebP, normalizada por Cloudinary) y cierre automático al terminar. Las mutaciones de tareas, propuestas y votaciones verifican también la hora de fin, sin depender del siguiente ciclo del cron.
- Las portadas se solicitan a una ruta que revalida membresía mediante RLS y transmite la imagen sin caché compartida. El servidor firma una URL de Cloudinary válida por 60 segundos; no entrega esa URL al cliente. Añadir portada es un paso posterior a guardar el evento.

- PWA sin dependencias: manifest, service worker propio e invitación a instalar; ver [pwa.md](docs/pwa.md). El service worker nunca guarda respuestas autorizadas (páginas, `/api`, Supabase, imágenes firmadas): sin conexión se muestra una pantalla propia en lugar de datos guardados.
- Realtime solo avisa y la pantalla se vuelve a pedir al servidor. Todo canal se abre después de `client.realtime.setAuth()`; si no, entra como anónimo y RLS descarta los avisos en silencio.

## Fases

| #   | Fase                                                                       | Rama                    | Estado                                   |
| --- | -------------------------------------------------------------------------- | ----------------------- | ---------------------------------------- |
| 0   | Base de datos (migraciones 000–023, RLS, pgTAP)                            | — (en `main`)           | Hecho                                    |
| 1   | Scaffold de la app (tooling, shell)                                        | `chore/scaffold-base`   | Hecho                                    |
| 2   | Módulo login (registro, sesión, Google)                                    | `feat/auth-login`       | Hecho                                    |
| 3   | Módulo grupos (crear, invitar, unirse)                                     | `feat/groups`           | Hecho                                    |
| 4   | Módulo eventos + RSVP                                                      | `feat/events-rsvp`      | Hecho                                    |
| 5   | Migraciones 024 (agregados de gastos) y 025 (cierre de RSVP)               | `feat/db-024-025`       | En `main`; aplicadas en Staging          |
| 6   | CI (checks + pgTAP) y pruebas E2E (Playwright)                             | `made`                  | Hecho; E2E como job propio en CI         |
| 7   | Propuestas y votaciones (US-06, migración 026)                             | `feat/proposals`        | Hecho; 026 aplicada en Staging           |
| 8   | Tareas (RF-800)                                                            | `feat/tasks`            | Hecho                                    |
| 9   | Diseño Noche serena y marca                                                | `made`                  | Hecho / en revisión                      |
| 10  | Gestión de salidas, perfil, recuperación de contraseña y gestión del grupo | `made`                  | Integrado en `made`; aplicado en Staging |
| 11  | Cronograma (US-05)                                                         | `made`                  | Hecho; migración aplicada en Staging     |
| 12  | Gastos (US-07)                                                             | `made`                  | Hecho; migración aplicada en Staging     |
| 13  | Comentarios, galería (Cloudinary), historial y estadísticas                | `made`                  | Hecho; sin migraciones nuevas            |
| 14  | Realtime en comentarios y PWA                                              | `made`                  | Hecho; migración aplicada en Staging     |
| 15  | Endurecimiento previo al lanzamiento (ver Notas)                           | 5 ramas (PR propio c/u) | En revisión; sin migraciones nuevas      |

## Notas

- Staging (verificado el 8 nov 2026) tiene `000`–`026`, `20261105052540_secure_task_access_guards` y nueve migraciones de `feat/poll-alignment` (`20261105120000` a `20261105163000`), integradas en la rama `made` (PR #22) el 8 nov 2026; el cron de cierre de eventos corre cada minuto. Producción no recibió estos cambios.
- Las migraciones con prefijo de fecha no siguen la regla `NNN_` de [CLAUDE.md](CLAUDE.md). Ya están aplicadas en Staging, así que no se renombran. Como `027_` se ordenaría antes que ellas en una base nueva, las siguientes usan la versión con fecha que registra Staging al aplicarlas (p. ej. `20261109032108_schedule_management.sql`).
- Cronograma: solo quien organiza la salida o un admin gestiona actividades, dentro del horario de la salida y mientras siga abierta; las propuestas aceptadas se agendan una sola vez (`schedule_items.proposal_id`). Verificado en Staging con una prueba transaccional (11/11) y advisors sin hallazgos nuevos.
- Gastos: `create_expense` registra gasto y partes juntos; un trigger diferido exige que las partes sumen el total, y pagador y participantes deben ser del grupo. Saldos y deudas se calculan por salida (`get_event_balances`, `get_event_debts`, compensando deudas mutuas) y `settle_event_debt` salda una pareja (deudor, acreedor o admin). Verificado en Staging (12/12). El advisor marca `settle_event_debt` como `SECURITY DEFINER` ejecutable: es intencional y valida la autorización dentro de la función.
- Comentarios, galería y estadísticas usan el esquema existente (`comments`, `photos`, `group_storage_usage`, vistas `member_participation` y `event_expense_summary`) más el endurecimiento en `20261111000000_harden_photos_comments.sql` (alcance de `cloudinary_public_id` por grupo/salida, edición de comentarios limitada a `body` y autor, validación de evento/grupo en respuestas, bloqueo en salidas en borrador o canceladas e `InitPlan` en `activity_proposals_insert`). Los comentarios viven en la pestaña Plan de cada salida; las fotos, en la pestaña Fotos (salidas publicadas o finalizadas), se reducen en el navegador a 1600 px antes de subir y se entregan por `/api/groups/:g/events/:e/photos/:id`, que revalida membresía con RLS. Historial y estadísticas están en `/groups/:id/stats`.
- Realtime y PWA: `20261110220341_comments_realtime` añade `comments` a la publicación `supabase_realtime` (aplicada en Staging el 10 nov 2026, advisors sin hallazgos nuevos). Probado en navegador con dos sesiones contra Staging: un comentario nuevo aparece en ~2 s y un borrado en menos de 1 s, sin recargar. Las votaciones tenían el mismo fallo de unión anónima al canal y quedaron corregidas.
- Producción estaba pausada en la última revisión; su historial no se pudo verificar. Confirmarlo antes de promover migraciones.
- Advisors de Staging (10 nov 2026): `20261110230200_advisor_policy_and_fk_indexes` corrigió la política `activity_proposals_insert` (ahora `(select auth.uid())`) y cubrió con índices las 13 claves foráneas compuestas. Quedan: la protección de contraseñas filtradas de Auth desactivada (se activa en el panel de Supabase, no por migración), avisos informativos de índices sin uso, y las funciones `SECURITY DEFINER` señaladas, que son las RPC previstas del diseño y cuentan con pruebas pgTAP de rechazo a no miembros.
- El CI (`.github/workflows/ci.yml`) ejecuta un guard contra `service_role`/`SUPABASE_SERVICE_ROLE_KEY` en `src/`, seguido de typecheck, lint, test, format y build, aplica todas las migraciones con el seed para correr la suite pgTAP, y corre las pruebas E2E (`e2e/`, Playwright) contra la app compilada y un Supabase local, en cada PR.
- Pruebas E2E: aislamiento entre grupos por URL directa, invitación → unirse → asistencia, comentarios en vivo entre dos sesiones, y manifest y modo sin conexión de la PWA. Verificadas contra Staging el 10 nov 2026 (5/5); el job de CI con Supabase local se comprueba en el primer PR que lo ejecute.
- Las pruebas de medios con Cloudinary real requieren configurar las tres variables de `.env.example`; no hay credenciales de medios en el entorno local. Las pruebas automatizadas cubren autorización, aislamiento de referencias y entrega mediante un proveedor simulado.
- Operaciones y cabeceras HTTP (`chore/ops-health-and-headers`): `GET /api/health` hace un ping sin datos a Supabase con el cliente anónimo (`HEALTH_CHECK_SECRET` / `CRON_SECRET` opcionales) invocado a diario por `vercel.json` para evitar la pausa por inactividad; `next.config.ts` aplica `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `Content-Security-Policy: frame-ancestors 'none'` y `Content-Security-Policy-Report-Only`.
- Fase 15 (12 nov 2026), cinco PR sin migraciones nuevas:
  - `feat/rate-limit-and-request-id`: `src/proxy.ts` asigna `request_id` (`X-Request-Id`) y limita a 60 mutaciones por minuto por usuario (o por IP sin sesión) con Upstash o, sin configurarlo, en memoria; responde 429 `RATE_LIMITED` con `Retry-After`. Las rutas de imágenes devuelven errores con el formato de docs/05-API §5.
  - `chore/observability` (sobre la anterior): logs JSON de errores del servidor en `src/instrumentation.ts`, Sentry opcional (`SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, SDK de navegador diferido) y Vercel Analytics + Speed Insights. JS inicial medido: 221 KB comprimidos.
  - `feat/comments-pagination`: 20 hilos por página con todas sus respuestas (`?comentarios=`, máx. 200).
  - `test/coverage-a11y-realtime` (sobre la anterior): `pnpm test:coverage` con umbrales de RNF-10 (60 % general, 80 % gastos y votaciones) en el CI; axe WCAG 2.1 AA en claro/oscuro a 390 px; E2E de votos en vivo con dos sesiones (RF-504).
  - `chore/repo-cleanup`: `next-env.d.ts` fuera del repo, pgTAP renumerado 001–028 y flujo `staging-migrations.yml` (dry-run tras CI verde en `main`; aplica solo con `STAGING_AUTO_APPLY=true` o a mano).
- Pendiente fuera de la fase 15: reactivar Producción, aplicar sus migraciones y la verificación previa al lanzamiento; activar la protección de contraseñas filtradas en Auth; medir LCP real con Speed Insights tras desplegar.
- Staging al día (12 nov 2026): se aplicaron en orden `20261111000000_harden_photos_comments`, `20261112000000_event_minimal_settlements`, `20261113000000_account_and_group_deletion`, `20261114000000_invite_preview` y `20261114010000_event_cancel_reason`, cada una en una transacción y registrada con la misma versión de su archivo. Antes faltaban y fallaban en Staging el registro de gastos (firma de `create_expense`), eliminar cuenta o grupo, la vista previa de invitaciones y cancelar salidas. Advisors tras cada una: sin hallazgos nuevos de nivel ERROR; los WARN son las RPC `SECURITY DEFINER` previstas (ahora 11) y la protección de contraseñas filtradas, que sigue desactivada. El historial de Staging sí registra `020`/`022`/`023`: no hace falta `migration repair`. Producción sigue pausada y sin estas migraciones.
