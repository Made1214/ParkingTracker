# 02-SRS-Parking-Tracker.docx

**PARKING TRACKER**
**Software Requirements Specification**
SRS — Especificación de requerimientos de software
**Versión:** 1.0
**Fecha:** 12 de junio de 2026
**Basado en:** PRD v1.0
**Estándar de referencia:** IEEE 830 (adaptado)

> **Nota de actualización (16 sep 2026):** la galería de fotos (RF-900) usa **Cloudinary**, no Supabase Storage — cambio post-aprobación registrado en `openspec/changes/define-stack/design.md` §7 y `CLAUDE.md`. Se corrigió la sección 5 (Dependencias) y la sección 4 (Restricciones Técnicas) en consecuencia. Los límites de Storage de Supabase (500 MB DB, 1 GB Storage) mencionados originalmente ya no aplican a las fotos de galería; los límites del tier gratuito de Cloudinary quedan como punto a verificar en implementación (ver `proposal.md` de `define-stack`, tabla de riesgos).

**Contenido**
# 1\. Introducción
Este documento especifica los requerimientos funcionales y no funcionales de **Parking Tracker**, plataforma web para organizar salidas entre amigos. Está dirigido al equipo de desarrollo (8 devs) y sirve como contrato técnico del MVP definido en el PRD v1.0.
**Convención de prioridades:** Must (imprescindible MVP), Should (deseable MVP), Could (si hay margen).
# 2\. Requerimientos Funcionales
## 2.1 Autenticación y perfiles (RF-100)

| ID | Requerimiento | Prioridad |
| ---| ---| --- |
| RF-101 | El sistema permitirá registro con email/contraseña con verificación por correo. | Must |
| RF-102 | El sistema permitirá inicio de sesión con Google (OAuth 2.0). | Must |
| RF-103 | El usuario podrá editar su perfil: nombre visible, nombre de usuario único y avatar. | Must |
| RF-104 | El sistema permitirá recuperar la contraseña vía email. | Must |
| RF-105 | Las sesiones se mantendrán activas mediante tokens renovables (refresh token). | Must |

## 2.2 Grupos y membresías (RF-200)

| ID | Requerimiento | Prioridad |
| ---| ---| --- |
| RF-201 | Un usuario podrá crear grupos con nombre, descripción y avatar. | Must |
| RF-202 | Cada grupo tendrá un código de invitación único regenerable por un administrador. | Must |
| RF-203 | Un usuario con el enlace/código podrá unirse al grupo como miembro. | Must |
| RF-204 | Existirán roles: administrador (gestiona grupo, miembros y todo el contenido) y miembro. | Must |
| RF-205 | Un administrador podrá expulsar miembros; un miembro podrá abandonar el grupo. | Should |
| RF-206 | Todo el contenido de un grupo será visible únicamente para sus miembros. | Must |

## 2.3 Eventos y asistencia (RF-300)

| ID | Requerimiento | Prioridad |
| ---| ---| --- |
| RF-301 | Un miembro podrá crear eventos con título, descripción, lugar, fecha/hora de inicio y fin, e imagen de portada. | Must |
| RF-302 | Los eventos tendrán estados: borrador, publicado, cancelado, finalizado. | Must |
| RF-303 | El creador o un administrador podrá editar o cancelar un evento. | Must |
| RF-304 | Cada miembro podrá responder asistencia: Voy / Quizás / No voy, modificable hasta el inicio. | Must |
| RF-305 | El detalle del evento mostrará contadores y listas de asistencia por estado. | Must |
| RF-306 | Los eventos con fecha pasada se marcarán automáticamente como finalizados. | Should |

## 2.4 Cronograma y propuestas (RF-400)

| ID | Requerimiento | Prioridad |
| ---| ---| --- |
| RF-401 | Un evento podrá tener un cronograma de ítems con título, descripción y hora de inicio/fin. | Must |
| RF-402 | Los ítems del cronograma serán reordenables y se mostrarán en orden cronológico. | Must |
| RF-403 | Cualquier miembro podrá proponer actividades para un evento (título + descripción). | Must |
| RF-404 | El organizador podrá aprobar o rechazar propuestas; las aprobadas podrán convertirse en ítems del cronograma. | Should |

## 2.5 Votaciones (RF-500)

| ID | Requerimiento | Prioridad |
| ---| ---| --- |
| RF-501 | Un miembro podrá crear votaciones asociadas a un evento con pregunta y de 2 a 10 opciones. | Must |
| RF-502 | Las votaciones podrán ser de opción única o múltiple, con fecha/hora de cierre opcional. | Must |
| RF-503 | Cada usuario podrá votar una vez (por opción) y cambiar su voto mientras la votación esté abierta. | Must |
| RF-504 | Los resultados se mostrarán en tiempo real (conteo y porcentaje por opción). | Should |
| RF-505 | Al cierre, la votación quedará bloqueada y se destacará la opción ganadora. | Must |

## 2.6 Comentarios (RF-600)

| ID | Requerimiento | Prioridad |
| ---| ---| --- |
| RF-601 | Cada evento tendrá un hilo de comentarios visible para los miembros del grupo. | Must |
| RF-602 | Los comentarios admitirán un nivel de respuesta (comentario → respuestas). | Should |
| RF-603 | El autor podrá editar/eliminar sus comentarios; un administrador podrá eliminar cualquiera. | Must |

## 2.7 Gastos compartidos (RF-700)

| ID | Requerimiento | Prioridad |
| ---| ---| --- |
| RF-701 | Un miembro podrá registrar gastos de un evento: descripción, monto, moneda, pagador, categoría y participantes. | Must |
| RF-702 | El sistema dividirá el gasto en partes iguales por defecto, con opción de montos personalizados que sumen el total. | Must |
| RF-703 | El sistema calculará el balance neto por miembro y sugerirá transferencias mínimas para saldar. | Must |
| RF-704 | Las deudas podrán marcarse como saldadas (registro manual). | Must |
| RF-705 | El evento mostrará el gasto total y el gasto por persona. | Should |

## 2.8 Tareas (RF-800)

| ID | Requerimiento | Prioridad |
| ---| ---| --- |
| RF-801 | Cada evento tendrá una lista de tareas con título, responsable opcional y fecha límite. | Must |
| RF-802 | Las tareas podrán marcarse como pendientes o completadas. | Must |

## 2.9 Galería de fotos (RF-900)

| ID | Requerimiento | Prioridad |
| ---| ---| --- |
| RF-901 | Los miembros podrán subir fotos (JPG, PNG, WebP; máx. 10 MB) a la galería de un evento, alojadas en Cloudinary. | Must |
| RF-902 | La galería mostrará miniaturas con vista ampliada, autor y fecha, servidas mediante URLs de Cloudinary firmadas por el servidor tras verificar membresía del grupo. | Must |
| RF-903 | El autor podrá eliminar sus fotos; un administrador, cualquiera. | Must |
| RF-904 | Las imágenes se comprimirán/redimensionarán en el cliente antes de subir. | Should |

## 2.10 Historial y estadísticas (RF-1000)

| ID | Requerimiento | Prioridad |
| ---| ---| --- |
| RF-1001 | El sistema mostrará el historial de eventos finalizados del grupo en modo solo lectura. | Must |
| RF-1002 | El sistema mostrará estadísticas por grupo: asistencia por miembro, eventos por mes, gasto total y promedio por evento. | Must |
| RF-1003 | Las estadísticas se calcularán mediante vistas SQL agregadas (sin procesamiento en cliente). | Should |

# 3\. Requerimientos No Funcionales

| ID | Categoría | Requerimiento |
| ---| ---| --- |
| RNF-01 | Rendimiento | LCP < 2.5 s y TTFB < 800 ms en p75 con conexión 4G; payload inicial < 300 KB comprimido. |
| RNF-02 | Rendimiento | Las consultas de listado responderán en < 500 ms en p95 con grupos de hasta 50 miembros y 200 eventos. |
| RNF-03 | Seguridad | Row Level Security (RLS) habilitado en todas las tablas; ningún dato accesible sin pertenencia al grupo. |
| RNF-04 | Seguridad | Toda la comunicación sobre HTTPS; tokens JWT gestionados por Supabase Auth con expiración de 1 hora y refresh. |
| RNF-05 | Seguridad | Validación de entradas en cliente y servidor (Zod); protección contra XSS e inyección SQL (consultas parametrizadas). |
| RNF-06 | Usabilidad | Diseño mobile-first responsive (320 px – 1920 px); acciones principales accesibles en ≤ 2 clics. |
| RNF-07 | Accesibilidad | Cumplimiento WCAG 2.1 nivel AA en contraste, foco visible y navegación por teclado. |
| RNF-08 | Disponibilidad | Objetivo de disponibilidad 99.5% (sujeto a SLA de Vercel y Supabase). |
| RNF-09 | Escalabilidad | Arquitectura serverless sin estado: soporta crecimiento horizontal sin cambios de código. |
| RNF-10 | Mantenibilidad | TypeScript estricto, ESLint + Prettier, cobertura de tests ≥ 60% en lógica de negocio (gastos y votaciones ≥ 80%). |
| RNF-11 | Compatibilidad | Últimas 2 versiones de Chrome, Safari, Firefox y Edge; iOS Safari y Chrome Android. |
| RNF-12 | Privacidad | Eliminación de cuenta con borrado/anonimizado de datos personales conforme a buenas prácticas de protección de datos. |
| RNF-13 | Observabilidad | Logs estructurados, monitoreo de errores (Sentry) y analítica de producto (Vercel Analytics). |

# 4\. Restricciones Técnicas
*   **Stack fijo:** Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui en frontend; Supabase (PostgreSQL, Auth, Realtime) y **Cloudinary** (medios de galería) como backend; despliegue en Vercel.
*   **Sin servidor propio:** no se administran servidores ni contenedores; toda lógica de servidor vive en Server Components, Route Handlers/Server Actions de Next.js o funciones de base de datos.
*   **Presupuesto:** tier gratuito de Supabase (500 MB DB) y Vercel (Hobby) durante el MVP; el tier gratuito de Cloudinary para medios queda como punto a verificar en implementación (ver `proposal.md` de `define-stack`, tabla de riesgos). El diseño debe respetar esos límites.
*   **Equipo y plazo:** 8 desarrolladores, 6 sprints de 2 semanas (12 semanas) hasta producción.
*   **Idioma:** interfaz en español; arquitectura preparada para i18n futura (textos centralizados).
# 5\. Dependencias

| Dependencia | Uso | Riesgo si falla |
| ---| ---| --- |
| Supabase Auth | Registro, login, OAuth Google, gestión de sesiones | Bloqueo total de acceso |
| Supabase PostgreSQL | Persistencia de todos los datos | Indisponibilidad de la app |
| Cloudinary | Fotos de la galería de eventos (US-08); subida y entrega firmadas por el servidor tras verificar membresía del grupo | Galería no funcional |
| Supabase Realtime | Resultados de votaciones y comentarios en vivo | Degradación: requiere refrescar |
| Vercel | Hosting, CI/CD, previews por PR | Sin despliegues |
| Google Cloud (OAuth) | Login con Google | Solo login por email |
| Librerías clave | shadcn/ui, TanStack Query, Zod, React Hook Form, date-fns, Recharts | Reemplazables; bajo riesgo |

# 6\. Arquitectura General
Arquitectura serverless de tres capas: el cliente Next.js (desplegado en Vercel) consume Supabase como Backend-as-a-Service y Cloudinary para medios de galería. La seguridad de datos se garantiza en la capa de base de datos mediante RLS, no en el cliente; Cloudinary no tiene RLS propio, por lo que el servidor firma cada subida y cada URL de entrega tras revalidar membresía del grupo en Postgres.
┌──────────────────────────────────────────────────────────┐
│ USUARIO (Navegador) │
└────────────────────────────┬─────────────────────────────┘
│ HTTPS
┌────────────────────────────▼─────────────────────────────┐
│ VERCEL — Next.js App │
│ • Server Components / Server Actions / Route Handlers │
│ • UI: React + Tailwind + shadcn/ui │
└──────────┬───────────────────────────────┬────────────────┘
│ supabase-js (anon key + JWT) │ subida/entrega firmada
┌──────────▼──────────────────────────┐ ┌──▼─────────────────┐
│ SUPABASE │ │ CLOUDINARY │
│ Auth (JWT/OAuth) │ PostgreSQL + RLS │ │ fotos de galería │
│ │ Realtime │ │ (sin RLS propio) │
└──────────────────────────────────────┘ └────────────────────┘
El detalle completo de componentes, flujos y decisiones se documenta en el **Documento 3 — Arquitectura Técnica**.
# 7\. Criterios de Aceptación del Sistema
*   Todos los RF marcados como Must implementados y verificados con pruebas funcionales.
*   Suite de RLS probada: un usuario fuera del grupo no puede leer ni escribir datos del grupo (tests automatizados).
*   Lighthouse ≥ 90 en Performance y Accessibility en las pantallas principales.
*   Cero errores críticos abiertos al cierre del Sprint 5.