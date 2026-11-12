# 05-API-Documentation-Parking-Tracker.docx

**PARKING TRACKER**
**API Documentation**
Contrato REST /api/v1 — endpoints, ejemplos y manejo de errores
**Versión:** 1.0
**Fecha:** 12 de junio de 2026
**Base URL:** [https://parkingtracker.app/api/v1](https://parkingtracker.app/api/v1)
**Contenido**
# 1\. Visión General
La aplicación consume datos principalmente vía Server Components y Server Actions de Next.js. Este documento define el **contrato REST equivalente** expuesto en \`/api/v1\` (Route Handlers), que sirve como: (a) especificación funcional única para el equipo, (b) API para futuras integraciones o app móvil. Ambas vías comparten la misma capa de validación (Zod) y la misma autorización (RLS).
*   Formato: JSON UTF-8. Fechas en ISO 8601 UTC. Identificadores UUID v4.
*   Versionado por prefijo de ruta (/api/v1). Cambios incompatibles → /api/v2.
*   Paginación por cursor: \`?limit=20&cursor=<uuid>\`; respuesta incluye \`next\_cursor\`.
# 2\. Autenticación
La autenticación la gestiona **Supabase Auth**. El cliente web usa cookies de sesión (httpOnly) gestionadas por @supabase/ssr; clientes externos envían el JWT como Bearer token:
GET /api/v1/groups
Authorization: Bearer <access\_token>

| Flujo | Mecanismo |
| ---| --- |
| Registro / Login email | supabase.auth.signUp() / signInWithPassword() — SDK, no pasa por /api/v1 |
| Login Google | supabase.auth.signInWithOAuth({ provider: "google" }) + /auth/callback |
| Renovación | Refresh token automático (SDK) o POST a Supabase /auth/v1/token |
| Autorización de datos | El JWT viaja a PostgreSQL; RLS decide fila a fila. La API nunca implementa permisos propios. |

# 3\. Endpoints
## 3.1 Perfil

| Método | Ruta | Descripción |
| ---| ---| --- |
| GET | /me | Perfil del usuario autenticado |
| PATCH | /me | Actualizar nombre, username o avatar |

## 3.2 Grupos y miembros

| Método | Ruta | Descripción |
| ---| ---| --- |
| GET | /groups | Grupos del usuario |
| POST | /groups | Crear grupo (creador queda como admin) |
| GET | /groups/{groupId} | Detalle del grupo |
| PATCH | /groups/{groupId} | Editar grupo (admin) |
| DELETE | /groups/{groupId} | Eliminar grupo (admin) |
| POST | /groups/join | Unirse con { "invite\_code": "..." } |
| POST | /groups/{groupId}/invite-code | Regenerar código (admin) |
| GET | /groups/{groupId}/members | Listar miembros con rol |
| DELETE | /groups/{groupId}/members/{userId} | Expulsar miembro (admin) o abandonar (uno mismo) |

## 3.3 Eventos y asistencia

| Método | Ruta | Descripción |
| ---| ---| --- |
| GET | /groups/{groupId}/events | Listar eventos (filtros: ?status=&from=&to=) |
| POST | /groups/{groupId}/events | Crear evento |
| GET | /events/{eventId} | Detalle completo del evento |
| PATCH | /events/{eventId} | Editar (autor o admin) |
| POST | /events/{eventId}/cancel | Cancelar evento |
| PUT | /events/{eventId}/attendance | Responder asistencia { "status": "going" } |
| GET | /events/{eventId}/attendance | Listado de respuestas con contadores |

## 3.4 Cronograma y propuestas

| Método | Ruta | Descripción |
| ---| ---| --- |
| GET | /events/{eventId}/schedule | Ítems del cronograma ordenados |
| POST | /events/{eventId}/schedule | Crear ítem |
| PATCH | /schedule-items/{itemId} | Editar ítem (position solo desempata) |
| DELETE | /schedule-items/{itemId} | Eliminar ítem |
| GET | /events/{eventId}/proposals | Listar propuestas |
| POST | /events/{eventId}/proposals | Crear propuesta |
| PATCH | /proposals/{proposalId} | Aprobar/rechazar (organizador) |

Nota MVP (RF-402): el cronograma se ordena cronológicamente por \`starts_at\`; \`position\` existe solo como desempate de ítems que empiezan a la misma hora y no hay reordenamiento manual.

## 3.5 Votaciones

| Método | Ruta | Descripción |
| ---| ---| --- |
| GET | /events/{eventId}/polls | Votaciones del evento con resultados |
| POST | /events/{eventId}/polls | Crear votación con opciones |
| PUT | /polls/{pollId}/vote | Votar { "option\_ids": \["..."\] } (reemplaza voto previo) |
| POST | /polls/{pollId}/close | Cerrar votación (creador o admin) |

## 3.6 Gastos

| Método | Ruta | Descripción |
| ---| ---| --- |
| GET | /events/{eventId}/expenses | Gastos del evento con splits |
| POST | /events/{eventId}/expenses | Crear gasto + división (transaccional) |
| DELETE | /expenses/{expenseId} | Eliminar gasto (autor o admin) |
| GET | /events/{eventId}/balance | Balance neto por miembro + transferencias sugeridas |
| POST | /expense-splits/{expenseId}/{userId}/settle | Marcar parte como saldada |

Nota MVP (RF-701): todos los grupos operan en **USD**; no hay selector de moneda por grupo (la columna \`currency\` del esquema persiste \`USD\` por defecto).

## 3.7 Tareas, comentarios y fotos

| Método | Ruta | Descripción |
| ---| ---| --- |
| GET | /events/{eventId}/tasks | Tareas del evento |
| POST | /events/{eventId}/tasks | Crear tarea |
| PATCH | /tasks/{taskId} | Editar / completar / asignar |
| GET | /events/{eventId}/comments | Comentarios paginados con respuestas |
| POST | /events/{eventId}/comments | Comentar (parent\_id opcional) |
| PATCH | /comments/{commentId} | Editar comentario propio |
| DELETE | /comments/{commentId} | Eliminar (autor o admin) |
| POST | /events/{eventId}/photos | Subir foto (multipart, ≤ 10 MB) — el servidor la valida, la sube a Cloudinary con URL firmada y registra la fila |
| GET | /events/{eventId}/photos | Galería; cada foto se entrega por la ruta privada de abajo |
| GET | /groups/{groupId}/events/{eventId}/photos/{photoId} | Entrega de foto: RLS + URL firmada por el servidor (TTL 60 s), transmitida al cliente sin exponerla |
| DELETE | /photos/{photoId} | Eliminar foto (autor o admin) |

Nota MVP (comentarios paginados): la pantalla de la salida muestra los 20 hilos más recientes con todas sus respuestas; "Ver comentarios anteriores" amplía la vista de 20 en 20 (`?comentarios=40`, hasta 200 hilos). Las respuestas no se paginan porque solo hay un nivel.

Nota: las fotos **no** usan Supabase Storage. La subida y la entrega se firman en el servidor contra Cloudinary (recurso autenticado) solo después de re-verificar la membresía del grupo con RLS; el cliente nunca recibe una URL firmada. La cuota es de 100 MB por grupo, aplicada por un trigger de la base de datos.

## 3.8 Historial y estadísticas

| Método | Ruta | Descripción |
| ---| ---| --- |
| GET | /groups/{groupId}/history | Eventos finalizados (paginado) |
| GET | /groups/{groupId}/stats | Participación, eventos/mes y resumen de gastos |

# 4\. Ejemplos de Request / Response
## 4.1 Crear evento
POST /api/v1/groups/8c1f.../events
Content-Type: application/json

{
"title": "Asado en la playa",
"description": "Salida de fin de mes",
"location": "Playa Santa Clara",
"starts\_at": "2026-07-04T16:00:00Z",
"ends\_at": "2026-07-04T23:00:00Z"
}

── 201 Created ──────────────────────────────
{
"data": {
"id": "f3b2c8e1-...",
"group\_id": "8c1f...",
"title": "Asado en la playa",
"status": "published",
"starts\_at": "2026-07-04T16:00:00Z",
"created\_by": "a91d...",
"created\_at": "2026-06-12T15:30:00Z"
}
}
## 4.2 Responder asistencia
PUT /api/v1/events/f3b2c8e1-.../attendance
{ "status": "going" }

── 200 OK ───────────────────────────────────
{
"data": { "event\_id": "f3b2c8e1-...", "user\_id": "a91d...",
"status": "going", "responded\_at": "2026-06-12T15:31:02Z" },
"counts": { "going": 8, "maybe": 2, "declined": 1, "pending": 4 }
}
## 4.3 Crear gasto con división
POST /api/v1/events/f3b2c8e1-.../expenses
{
"description": "Carne y carbón",
"amount": 85.50,
"currency": "USD",
"category": "comida",
"paid\_by": "a91d...",
"split": { "mode": "equal", "participant\_ids": \["a91d...", "b22e...", "c33f..."\] }
}

── 201 Created ──────────────────────────────
{
"data": {
"id": "9e4a...", "amount": 85.50,
"splits": \[
{ "user\_id": "a91d...", "share\_amount": 28.50, "settled": true },
{ "user\_id": "b22e...", "share\_amount": 28.50, "settled": false },
{ "user\_id": "c33f...", "share\_amount": 28.50, "settled": false }
\]
}
}
## 4.4 Balance del evento
GET /api/v1/events/f3b2c8e1-.../balance

── 200 OK ───────────────────────────────────
{
"data": {
"total": 142.00,
"balances": \[
{ "user\_id": "a91d...", "paid": 85.50, "owes": 47.33, "net": 38.17 },
{ "user\_id": "b22e...", "paid": 56.50, "owes": 47.33, "net": 9.17 },
{ "user\_id": "c33f...", "paid": 0.00, "owes": 47.34, "net": -47.34 }
\],
"suggested\_transfers": \[
{ "from": "c33f...", "to": "a91d...", "amount": 38.17 },
{ "from": "c33f...", "to": "b22e...", "amount": 9.17 }
\]
}
}
## 4.5 Votar
PUT /api/v1/polls/77aa.../vote
{ "option\_ids": \["op-1"\] }

── 200 OK ───────────────────────────────────
{ "data": { "poll\_id": "77aa...", "results": \[
{ "option\_id": "op-1", "label": "Playa", "votes": 6, "pct": 60.0 },
{ "option\_id": "op-2", "label": "Montaña", "votes": 4, "pct": 40.0 }
\] } }
# 5\. Manejo de Errores
Formato uniforme de error en todas las rutas:
{
"error": {
"code": "VALIDATION\_ERROR",
"message": "El título es obligatorio.",
"details": \[ { "field": "title", "issue": "required" } \],
"request\_id": "req\_8f31c2"
}
}

| HTTP | Código | Cuándo |
| ---| ---| --- |
| 400 | VALIDATION\_ERROR | Body o parámetros inválidos (detalle por campo, vía Zod) |
| 401 | UNAUTHENTICATED | Sin sesión o token expirado |
| 403 | FORBIDDEN | Autenticado pero sin permiso (no es miembro / no es admin) — respuesta de RLS |
| 404 | NOT\_FOUND | Recurso inexistente o invisible para el usuario (no se distingue, por privacidad) |
| 409 | CONFLICT | Violación de unicidad (username tomado, voto duplicado en opción única) |
| 413 | PAYLOAD\_TOO\_LARGE | Foto > 10 MB |
| 422 | BUSINESS\_RULE | Regla de negocio: votación cerrada, splits no suman el total, evento finalizado |
| 429 | RATE\_LIMITED | Límite de peticiones excedido (cabecera Retry-After) |
| 500 | INTERNAL | Error no controlado (se registra en Sentry con request\_id) |
| 502 | UPSTREAM\_ERROR | Un servicio externo (Cloudinary) respondió con error o con contenido inesperado |
| 503 | SERVICE\_UNAVAILABLE | La base de datos o el servicio de medios no están disponibles |

*   Los errores 4xx nunca exponen detalles internos (SQL, stack traces).
*   \`request\_id\` correlaciona la respuesta con los logs y Sentry.
*   Rate limiting en mutaciones: 60 req/min por usuario (middleware - Upstash o token bucket en memoria edge).
*   Implementación: `src/proxy.ts` asigna un `request_id` (`req_` + 12 hex) a cada petición, lo reenvía a la app en `x-request-id` y lo devuelve en `X-Request-Id`. Toda petición que no sea `GET`/`HEAD`/`OPTIONS` (incluidas las server actions) cuenta para el límite, por usuario o, sin sesión, por IP; el contador vive en Upstash si `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` están definidos y, si no, en memoria por instancia. La respuesta 429 lleva `Retry-After`, `X-RateLimit-Limit` y `X-RateLimit-Remaining`.
# 6\. Convenciones Adicionales
*   **Idempotencia:** PUT de asistencia y voto son idempotentes (upsert). POST de gastos acepta cabecera Idempotency-Key opcional.
*   **CORS:** /api/v1 cerrado al dominio propio en MVP; se abrirá con API keys si se publica para terceros.
*   **Realtime:** votos y comentarios también se emiten por canales Supabase Realtime (\`event:{eventId}\`); la API REST es la fuente de verdad.