# 03-Arquitectura-Tecnica-Parking-Tracker.docx

**PARKING TRACKER**
**Arquitectura Técnica**
Diseño de alto nivel, componentes y flujos del sistema
**Versión:** 1.0
**Fecha:** 12 de junio de 2026
**Basado en:** PRD v1.0 / SRS v1.0

> **Nota de actualización (16 sep 2026):** la galería de fotos usa **Cloudinary**, no Supabase Storage — decisión post-aprobación de `openspec/changes/define-stack/design.md` §7, documentada también en `CLAUDE.md`. Se corrigieron el diagrama de alto nivel, la tabla de componentes (§2), la sección 4.1 (buckets), el flujo de fotos (§7.3) y las variables de entorno (§8) en consecuencia. El mecanismo de subida de **avatar** (mencionado en §4.1 del documento original) todavía no está implementado en el repositorio: hoy `profiles.avatar_url` es solo un campo de texto poblado desde los metadatos de OAuth de Google (`005_core_rls.sql`); no existe bucket ni endpoint de subida propio. Queda como punto abierto para cuando se implemente E2.F3.T3.

**Contenido**
# 1\. Arquitectura de Alto Nivel
Parking Tracker adopta una arquitectura **Jamstack/serverless** con Supabase como Backend-as-a-Service para Auth/PostgreSQL/Realtime, y **Cloudinary** como servicio de medios para la galería de fotos. No existe backend propio que mantener: la lógica de presentación y orquestación vive en Next.js (Vercel) y la lógica de datos y seguridad vive en PostgreSQL (RLS, funciones y triggers). Cloudinary no tiene RLS propio, así que el servidor firma cada subida y cada URL de entrega tras revalidar `is_group_member(group_id)` en Postgres — la misma comprobación que ya protege la fila de `photos` por RLS.
**Decisión clave y justificación:** frente a la alternativa de un backend propio (Node/Nest + API REST), se elige Supabase porque (a) elimina \~30% del esfuerzo de desarrollo en un plazo de 12 semanas, (b) provee Auth y Realtime integrados, y (c) RLS ofrece seguridad a nivel de fila auditable y centralizada. El coste es un acoplamiento moderado al proveedor, mitigado porque PostgreSQL es estándar y migrable. Los medios de galería se delegan a Cloudinary (en vez de Supabase Storage) porque resuelve compresión y derivados de imagen (resize/formato/calidad) por transformación de URL, sin que el cliente tenga que generar ni almacenar variantes por separado.
┌─────────────────────────────────────────────────────────────────┐
│ CLIENTE (Browser) │
│ React 18+ · Next.js App Router · Tailwind CSS · shadcn/ui │
│ TanStack Query (caché) · React Hook Form + Zod (formularios) │
└───────────────┬─────────────────────────────┬───────────────────┘
│ RSC / Server Actions │ supabase-js
▼ ▼ (Realtime WS)
┌───────────────────────────────┐ ┌─────────────────────────────┐
│ VERCEL (Edge/Node) │ │ SUPABASE │
│ • Server Components (SSR) │──▶│ ┌───────────────────────┐ │
│ • Server Actions (mutación) │ │ │ Auth: JWT, OAuth, │ │
│ • Route Handlers (/api/v1) │ │ │ email verification │ │
│ • Middleware (sesión) │ │ ├───────────────────────┤ │
│ • ISR/caché por segmento │ │ │ PostgreSQL 15 + RLS │ │
└──────────────┬────────────────┘ │ │ funciones · triggers │ │
│ │ │ vistas estadísticas │ │
│ subida/entrega firmada │ ├───────────────────────┤ │
▼ │ │ Realtime (WebSocket) │ │
┌───────────────────────────────┐ │ └───────────────────────┘ │
│ CLOUDINARY │ └─────────────────────────────┘
│ Fotos de galería (sin RLS │
│ propio; delivery type: │ CI/CD: GitHub → Vercel
│ authenticated, firmado) │ (preview por PR, prod en main)
└───────────────────────────────┘
Sentry · Vercel Analytics
# 2\. Diagrama Textual de Componentes

| Componente | Responsabilidad | Tecnología |
| ---| ---| --- |
| Web App (UI) | Renderizado, navegación, formularios, estado de UI | Next.js App Router, React, shadcn/ui |
| Capa de datos cliente | Caché, revalidación, estados de carga/error, suscripciones realtime | TanStack Query + supabase-js |
| Server Actions / Route Handlers | Mutaciones validadas, orquestación, lógica que requiere service-role (invitaciones), firma de subida/entrega de Cloudinary | Next.js + Zod |
| Auth Middleware | Refresco de sesión y protección de rutas privadas | middleware.ts + @supabase/ssr |
| Módulo Auth | Registro, login, OAuth, recuperación de contraseña | Supabase Auth |
| Base de datos | Persistencia, integridad, autorización (RLS), agregaciones | PostgreSQL + SQL functions |
| Medios de galería | Fotos de eventos, almacenadas fuera de Postgres; nunca servidas con URL sin firmar | Cloudinary (signed upload + delivery), gatillado server-side |
| Realtime | Votos y comentarios en vivo | Supabase Realtime (canales por evento) |
| Observabilidad | Errores, métricas web, logs | Sentry + Vercel Analytics |

# 3\. Arquitectura Frontend
## 3.1 Estructura de carpetas
src/
├── app/ # App Router
│ ├── (auth)/ # Rutas públicas
│ │ ├── login/page.tsx
│ │ ├── registro/page.tsx
│ │ └── recuperar/page.tsx
│ ├── (app)/ # Rutas privadas (layout con sesión)
│ │ ├── dashboard/page.tsx
│ │ ├── grupos/\[groupId\]/
│ │ │ ├── page.tsx # Home del grupo
│ │ │ ├── eventos/\[eventId\]/page.tsx # Detalle con tabs
│ │ │ ├── historial/page.tsx
│ │ │ ├── estadisticas/page.tsx
│ │ │ └── ajustes/page.tsx
│ │ ├── perfil/page.tsx
│ │ └── unirse/\[codigo\]/page.tsx # Invitación
│ ├── api/v1/ # Route Handlers (BFF)
│ ├── layout.tsx · globals.css
├── components/
│ ├── ui/ # shadcn/ui (generados)
│ ├── eventos/ · gastos/ · votaciones/ · galeria/ ...
├── lib/
│ ├── supabase/ (client.ts, server.ts, middleware.ts)
│ ├── cloudinary/ (signed-upload.ts, signed-delivery.ts — solo servidor)
│ ├── validations/ # Esquemas Zod compartidos
│ └── utils/ # fechas, moneda, balances
├── hooks/ # useEvento, useBalance, useRealtime...
└── types/ # database.types.ts (generado) + dominio
## 3.2 Patrones y convenciones
*   **Server Components por defecto:** las páginas leen datos en el servidor (SEO, menos JS). Componentes interactivos marcados con "use client".
*   **Mutaciones con Server Actions** validadas con Zod + revalidación de caché (revalidatePath). Las lecturas reactivas (votos, comentarios) usan TanStack Query + Realtime.
*   **Tipado end-to-end:** \`supabase gen types typescript\` genera tipos de la BD consumidos en todo el código.
*   **UI consistente:** sólo componentes shadcn/ui + tokens de Tailwind; sin CSS ad-hoc. Tema con variables CSS (modo claro/oscuro).
*   **Errores:** error.tsx por segmento, toasts (sonner) para fallos de mutación, reporte a Sentry.
# 4\. Arquitectura Backend (Supabase + Cloudinary)
## 4.1 Servicios utilizados

| Servicio | Uso en Parking Tracker |
| ---| --- |
| Auth | Email/contraseña con verificación, Google OAuth, recuperación. JWT con claims de usuario. |
| PostgreSQL | Modelo relacional completo (doc. 4). RLS como única capa de autorización. Funciones SQL para lógica crítica: unirse por código, balances de gastos, cierre de votaciones. |
| Cloudinary | Fotos de la galería de eventos. Sin bucket ni políticas de Storage: cada subida se firma en el servidor (signed upload params, sin exponer el API secret al cliente) y cada URL de entrega se firma solo después de revalidar `is_group_member(group_id)`. Los assets se guardan con `type: authenticated`; un `cloudinary_public_id` nunca es autorización suficiente por sí solo. |
| Realtime | Canales postgres\_changes filtrados por event\_id para votos y comentarios. |
| Edge Functions | No se usan en el MVP; reservadas para notificaciones futuras. |

## 4.2 Lógica de negocio: dónde vive

| Regla | Ubicación | Motivo |
| ---| ---| --- |
| Autorización (quién ve/edita qué) | RLS en PostgreSQL | Inviolable desde el cliente; un solo punto de verdad |
| Unirse a grupo por código | Función SQL SECURITY DEFINER | Requiere leer grupo sin ser miembro aún, de forma controlada |
| Cálculo de balances y transferencias | Vista + función SQL | Consistencia y rendimiento; testeable con pgTAP |
| Autorización de subida/entrega de fotos | Server Action / Route Handler que revalida `is_group_member` antes de firmar Cloudinary | Cloudinary no tiene RLS propio; la comprobación debe repetirse en el servidor |
| Validación de formularios | Zod (cliente + Server Action) | Feedback inmediato y defensa en profundidad |
| Marcar eventos finalizados | pg\_cron diario / al consultar | Evita procesos externos |

# 5\. Arquitectura de Base de Datos
PostgreSQL 15 gestionado por Supabase. Esquema \`public\` con 15 tablas, 2 vistas de estadísticas y funciones auxiliares. Principios:
*   **Integridad por diseño:** claves foráneas con ON DELETE adecuado (CASCADE en contenido hijo, SET NULL en autores), CHECK constraints para estados y montos, UNIQUE para invariantes (un RSVP por usuario/evento).
*   **RLS en el 100% de las tablas**, basado en una función \`is\_group\_member(group\_id)\` para evitar políticas recursivas.
*   **Identificadores UUID** generados en BD; timestamps \`timestamptz\` UTC con \`created\_at/updated\_at\` automáticos.
*   **Vistas agregadas** para estadísticas (asistencia por miembro, gastos por evento), evitando cálculo en cliente.

El esquema completo, índices y políticas se detallan en el **Documento 4 — Diseño de Base de Datos**.

# 6\. Flujo de Autenticación
## 6.1 Registro e inicio de sesión
Usuario Next.js (Vercel) Supabase Auth PostgreSQL
│ 1. signup form │ │ │
├────────────────────▶│ 2. auth.signUp() │ │
│ ├────────────────────────▶│ 3. crea auth.user │
│ │ ├──────────────────▶│
│ 4. email verificación◀────────────────────────┤ (trigger crea │
│ 5. clic en enlace │ │ public.profiles)│
├────────────────────▶│ 6. /auth/callback │ │
│ ├── exchangeCodeForSession▶ │
│ 7. cookies de sesión◀─ (access JWT + refresh) │ │
│ 8. redirect /dashboard │ │
## 6.2 Sesión en cada request
1. middleware.ts intercepta cada request privado y refresca el JWT si expiró (@supabase/ssr, cookies httpOnly).
2. Los Server Components crean un cliente Supabase de servidor con la cookie de sesión: cada query viaja con el JWT del usuario.
3. PostgreSQL evalúa RLS con auth.uid() extraído del JWT: la autorización ocurre en la base de datos, nunca en el cliente.
4. Si no hay sesión válida, el middleware redirige a /login preservando la URL de destino.
## 6.3 OAuth Google
signInWithOAuth({ provider: "google" }) → consentimiento de Google → callback de Supabase → /auth/callback intercambia el código por sesión → si es primer login, el trigger crea el perfil. Los scopes se limitan a email y perfil básico.
# 7\. Flujo de Datos
## 7.1 Lectura (ej.: detalle de evento)
1. El usuario navega a /grupos/\[id\]/eventos/\[eventId\].
2. El Server Component ejecuta en paralelo las consultas (evento, asistencia, cronograma, gastos) con el JWT del usuario; RLS filtra automáticamente.
3. HTML renderizado en servidor llega al cliente; TanStack Query hidrata el estado para interacciones.
4. El cliente abre canal Realtime del evento para votos/comentarios en vivo.
## 7.2 Escritura (ej.: registrar un gasto)
1. El formulario (React Hook Form) valida con Zod en el cliente.
2. Se invoca la Server Action createExpense(input); revalida con Zod en servidor.
3. Insert de gasto + splits en una función SQL transaccional (todo o nada). RLS verifica membresía.
4. revalidatePath() refresca el segmento; la UI muestra el nuevo balance. Errores → toast + Sentry.
## 7.3 Fotos (Cloudinary)
1. El cliente comprime/redimensiona la imagen (máx. 1920 px, calidad 0.8).
2. El cliente pide al servidor (Server Action / Route Handler) parámetros de subida firmados; el servidor revalida `is_group_member(group_id)` antes de firmar y nunca expone el API secret de Cloudinary.
3. El cliente sube directo a Cloudinary con esos parámetros firmados; el asset se guarda con `type: authenticated` (sin URL pública/sin firmar).
4. El servidor inserta el registro en la tabla `photos` con `cloudinary_public_id` (y `cloudinary_version` si aplica) — nunca con una ruta de Storage.
5. La galería nunca construye la URL de entrega en el cliente: pide al servidor una URL de Cloudinary firmada de corta duración (TTL 1 h), que solo se genera tras revalidar `is_group_member`. `next/image` sigue prohibido para estos assets (evita re-optimizar una URL ya firmada).
# 8\. Entornos y Despliegue

| Entorno | Infraestructura | Uso |
| ---| ---| --- |
| Local | supabase start (Docker) + next dev | Desarrollo diario; migraciones con supabase CLI |
| Preview | Vercel Preview por PR + proyecto Supabase de staging | QA y revisión de cada Pull Request |
| Producción | Vercel (main) + proyecto Supabase productivo | Usuarios finales |

*   **Migraciones versionadas** en /supabase/migrations; se aplican a staging automáticamente en CI y a producción con aprobación manual.
*   **CI (GitHub Actions):** lint, typecheck, tests unitarios y build en cada PR; bloqueo de merge si falla.
*   **Variables de entorno** gestionadas en Vercel: NEXT\_PUBLIC\_SUPABASE\_URL, NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY; SUPABASE\_SERVICE\_ROLE\_KEY y CLOUDINARY\_API\_SECRET solo en servidor, nunca expuestas al cliente; CLOUDINARY\_CLOUD\_NAME y CLOUDINARY\_API\_KEY según corresponda al SDK server-side.
# 9\. Decisiones de Arquitectura (resumen ADR)

| Decisión | Alternativa descartada | Justificación |
| ---| ---| --- |
| Supabase BaaS | API propia Node/Nest | Time-to-market de 12 semanas; Auth/Realtime resueltos sin infraestructura propia |
| Cloudinary para galería (supersede a Supabase Storage) | Supabase Storage (diseño original de `define-stack`) | Compresión y derivados por transformación de URL; Cloudinary no tiene RLS, así que el servidor firma cada subida/entrega tras revalidar `is_group_member` |
| RLS como autorización | Checks en capa de aplicación | Imposible de evadir desde el cliente; testeable en SQL |
| Server Actions + RSC | API REST completa propia | Menos código y latencia; REST /api/v1 se mantiene solo como contrato documentado para integraciones |
| TanStack Query | Redux/Zustand global | El estado del MVP es 90% estado de servidor (caché), no estado global |
| Monorepo simple (una app) | Turborepo multi-paquete | Un solo deployable; evitar complejidad prematura |

# 10\. Riesgos Técnicos y Mitigaciones

| Riesgo | Mitigación |
| ---| --- |
| Políticas RLS incorrectas exponen datos | Suite de tests de RLS (usuario A no ve grupo B) ejecutada en CI desde Sprint 1 |
| Recursión/perf en políticas RLS | Función helper is\_group\_member con SECURITY DEFINER + índices en claves de filtrado |
| Límites del tier gratuito de Supabase (500 MB DB) y de Cloudinary (a verificar) | Compresión de imágenes, monitoreo de uso, cuota de 100 MB por grupo (`group_storage_usage`), plan de upgrade documentado |
| Un `cloudinary_public_id` filtrado se use para construir una URL de entrega sin pasar por el servidor | El cliente nunca construye URLs de entrega; solo el servidor firma, tras revalidar `is_group_member` |
| Realtime con muchas suscripciones | Un canal por evento abierto solo en el detalle; cierre al desmontar |
| Lock-in de Supabase | PostgreSQL estándar + migraciones SQL versionadas: portable a cualquier Postgres |