# PLAN.md

Fuente de verdad del proyecto. Producto: [PRD](docs/01-PRD-Parking-Tracker.md). Decisiones técnicas: [OpenSpec](openspec/changes/define-stack/design.md). Reglas de trabajo: [RULES.md](RULES.md).

## Decisiones

- Next.js (App Router) + Supabase (Postgres, Auth, RLS). Gestor de paquetes: **pnpm**.
- Esquema mediante migraciones SQL inmutables (`supabase/migrations`). Sin Drizzle.
- Cada grupo es un tenant; RLS es la autoridad de autorización. Solo clave pública + JWT del usuario en la app; nunca clave de servicio.
- Estructura: `src/app` (rutas delgadas), `src/features/<modulo>` (API pública en `index.ts`), `src/shared` (UI, utilidades, clientes Supabase).
- Sistema visual: tokens compartidos de color, espaciado, tipografía, radios y sombras; ver [design-system.md](docs/design-system.md).
- Desarrollo **por módulos**, una rama y un PR por módulo.
- Votaciones: cierre programado opcional; sin fecha cierran manualmente o al terminar el evento. Los porcentajes se calculan sobre opciones votadas (también en selección múltiple), y los empates se indican explícitamente. El organizador o administrador revisa propuestas; su conversión en actividades se completa con el módulo cronograma.
- Grupos: ajustes de nombre, descripción e imagen; roles, expulsión, salida y renovación de invitación. La base de datos serializa salidas/degradaciones para conservar al menos un administrador y exige membresía vigente también en borrados directos de contenido previamente creado.
- Perfil y recuperación: rutas `/profile`, `/forgot-password` y `/reset-password`; recuperación PKCE mediante `/auth/callback`. Los nombres de usuario se guardan en minúsculas, son únicos y admiten de 3 a 24 letras, números o guiones bajos. Los avatares personalizados usan Cloudinary privado, con lectura limitada al usuario y a personas con grupos en común.
- Gestión de eventos: edición/cancelación antes del inicio, borradores visibles al grupo, portada privada de hasta 5 MB (JPG/PNG/WebP, normalizada por Cloudinary) y cierre automático al terminar. Las mutaciones de tareas, propuestas y votaciones verifican también la hora de fin, sin depender del siguiente ciclo del cron.
- Las portadas se solicitan a una ruta que revalida membresía mediante RLS y transmite la imagen sin caché compartida. El servidor firma una URL de Cloudinary válida por 60 segundos; no entrega esa URL al cliente. Añadir portada es un paso posterior a guardar el evento.

## Fases

| #   | Fase                                                                                     | Rama                  | Estado      |
| --- | ---------------------------------------------------------------------------------------- | --------------------- | ----------- |
| 0   | Base de datos (migraciones 000–023, RLS, pgTAP)                                          | — (en `main`)         | Hecho       |
| 1   | Scaffold de la app (tooling, shell)                                                      | `chore/scaffold-base` | Hecho       |
| 2   | Módulo login (registro, sesión, Google)                                                  | `feat/auth-login`     | Hecho       |
| 3   | Módulo grupos (crear, invitar, unirse)                                                   | `feat/groups`         | Hecho       |
| 4   | Módulo eventos + RSVP                                                                    | `feat/events-rsvp`    | Hecho       |
| 5   | Migraciones 024 (agregados de gastos) y 025 (cierre de RSVP)                             | `feat/db-024-025`     | En revisión |
| 6   | CI y pruebas E2E (Playwright)                                                            | `chore/ci-e2e`        | Pendiente   |
| 7   | Resto de módulos del PRD (propuestas, gastos, tareas, galería, historial, Realtime, PWA) | —                     | Pendiente   |

## Notas

- Staging tiene registradas las migraciones `000`–`026` y `20261105052540_secure_task_access_guards`. Una prueba transaccional verificó la creación, votación y cierre de una encuesta, además de la creación de una tarea. La suite completa sigue pendiente: pgTAP no está disponible en ese entorno.
- La suite local de base de datos pasó con estas migraciones; esto no sustituye la verificación de Staging.
- Producción estaba pausada en la última revisión y su historial no se pudo verificar. Confirmarlo antes de promover nuevas migraciones.
- Las pruebas de medios con Cloudinary real requieren configurar las tres variables de `.env.example`; no hay credenciales de medios en el entorno local. Las pruebas automatizadas cubren autorización, aislamiento de referencias y entrega mediante un proveedor simulado.
- Staging tiene aplicadas las migraciones de gestión de eventos `20261105120000` a `20261105133000` (cuatro archivos). El cron de cierre está programado cada minuto. Producción no recibió estos cambios.
