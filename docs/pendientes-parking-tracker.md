# Parking Tracker — Qué falta

Actualización del análisis del 10 de noviembre de 2026. Contrasta el código de `main` con la documentación del repositorio (PRD, SRS, Arquitectura, API, UI/UX) y con lo que solo está en ClickUp: el documento **08 · Planificación** (criterios por tarea de los 6 sprints), los **91 tareas** del espacio _Parking Tracker_ y la lista **define-stack: Foundation**.

Fecha: 12 de noviembre de 2026.

## Estado general

- Todos los requisitos "Must" del PRD y del SRS tienen pantalla y lógica, salvo **Legal y SEO** (E10.F3.T2), que no existe.
- Del análisis anterior solo quedan abiertos Producción, contraseñas filtradas, Lighthouse, la matriz de navegadores y el largo de Plan en móvil; el resto se cerró en los PR #24 a #36.
- **El PR #37 está pendiente de fusionar.** #33 (observabilidad) y #35 (cobertura, axe y votos en vivo) se fusionaron en sus ramas base, no en `main`; #37 los trae.
- ClickUp no refleja el avance: 86 de 91 tareas siguen en _backlog_ aunque la mayoría están hechas (ver §9).

---

## 0. Cerrado desde el 10 de noviembre

| Punto del análisis anterior | Dónde se cerró |
| --- | --- |
| 1.1 – 1.5 seguridad de fotos y comentarios | #27 |
| 1.7 límite de peticiones · formato de error y `request_id` | #32 |
| 1.8 cabeceras de seguridad · `/api/health` y tarea diaria | #26 |
| 1.9 guardia de `service_role` en el CI | #26 |
| 1.10 pgTAP de las funciones `SECURITY DEFINER` | #27 (`025_security_definer_membership.sql`) |
| RF-801 fecha límite · "Añadir al cronograma" desde la votación · aviso "¡Sube tus fotos!" | #28 |
| RF-703 transferencias mínimas · idempotencia en gastos | #29 |
| RNF-12 eliminar cuenta · eliminar grupo | #31 |
| Comentarios paginados | #34 |
| RF-701 (solo USD) y RF-402 (orden por hora) | Documentados como decisión del MVP |
| Pestañas y Gastos en móvil · logo y contraste del avatar | #25 |
| Comentarios en tiempo real · PWA · Playwright | #24 |
| Seed que no permitía iniciar sesión · README · documentos UI/UX y API | #24 – #30 |
| Migraciones a Staging desde el CI · `next-env.d.ts` · numeración de pgTAP | #36 |
| Sentry, logs estructurados, Vercel Analytics | #33 → **llega con #37** |
| Cobertura ≥ 60 % / ≥ 80 %, axe WCAG AA en CI, RF-504 con dos sesiones | #35 → **llega con #37** |

---

## 1. Antes de lanzar — prioridad alta

| # | Pendiente | Qué hacer | Tarea ClickUp |
| --- | --- | --- | --- |
| 1.1 | Fusionar #37 | Revisar su CI: es la primera vez que corren axe en las pantallas con sesión y la prueba de votos en vivo. | E1.F3.T3, E10.F2.T3 |
| 1.2 | **Producción pausada y sin migraciones posteriores a la 026** | Reactivarla, comparar su historial con `supabase/migrations/` y aplicar la misma secuencia que Staging; `get_advisors` después. | E10.F3.T1 |
| 1.3 | Protección de contraseñas filtradas desactivada | Supabase → Auth → Passwords, en Staging y en Producción. | E10.F2.T2 |
| 1.4 | Verificación en Producción | Correo de confirmación, Google OAuth, subida real a Cloudinary, cron de cierre de salidas, `/api/health` desde Vercel. | E10.F3.T3 |
| 1.5 | Configuración fuera del repo | GitHub: secretos `SUPABASE_ACCESS_TOKEN`, `STAGING_DB_PASSWORD`; variables `STAGING_PROJECT_REF`, `STAGING_AUTO_APPLY`. Staging: `supabase migration repair --status applied 020 022 023` una vez. Vercel: Upstash (opcional), `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, activar Analytics y Speed Insights, `CRON_SECRET`. | E1.F3.T2, E1.F3.T3 |
| 1.6 | **Legal y SEO** (no existe nada) | Páginas de privacidad y términos, metadatos Open Graph, `robots.ts` y `sitemap.ts` (solo rutas públicas). | E10.F3.T2 |
| 1.7 | Protección de la rama `main` | Exigir los 3 jobs del CI (app, pgTAP, E2E) antes de fusionar. Se configura en GitHub, no en el repo. | E1.F3.T1, define-stack PR 11 |
| 1.8 | Checklist de go-live | Pruebas de humo en Producción, monitoreo 48 h, primeros grupos. | E10.F3.T3 |

---

## 2. Funcionalidad que pide ClickUp y no está

Criterios del documento 08 que no aparecen en el código. Ordenados por prioridad de la tarea.

| Tarea | Prioridad | Qué falta |
| --- | --- | --- |
| E8.F1 criterio de aceptación | Must | En la división igual, **los centavos sobrantes van al pagador**. Hoy van a los primeros participantes de la lista (`equalShares`). |
| E4.F1.T4 Cancelación | High | **Motivo opcional** al cancelar una salida (columna y campo). |
| E4.F2.T1 Home del grupo | Urgent | Pestañas **Próximas / Pasadas** y paginación por cursor. Hoy es una sola lista: próximas primero y luego el historial completo. |
| E4.F4.T2 Responsive y estados | High | **Error boundary por pestaña**: hoy un error en una pestaña tira la página entera (`src/app/error.tsx`). |
| E8.F3.T2 UI checklist | High | **Tareas vencidas destacadas** (la fecha se muestra igual aunque haya pasado). |
| E3.F2.T1 Unirse por enlace | Urgent | **Vista previa del grupo** (nombre, imagen, miembros) en `/join/[code]` antes de aceptar. Hoy solo se ve el código. |
| E2.F3.T2 Username único | High | Aviso **en vivo** de disponibilidad y sugerencia desde el correo. Hoy el error aparece al guardar. |
| E5.F1.T1 Cronograma | Urgent | **Aviso de solape** entre actividades (advertencia, no bloqueo). |
| E5.F1.T2 Timeline | High | **Actividad en curso destacada** el día de la salida. |
| E9.F2.T1 Lightbox | High | **Deslizar con el dedo** entre fotos (hoy solo flechas de teclado y botones). |
| E1.F4.T2 AppShell | High | **Cambio rápido de grupo** (GroupSwitcher) y migas de pan. |
| E4.F3.T3 Asistencia en vivo | Normal | Contadores de asistencia por Realtime (hoy se actualizan al recargar o por el sondeo). |
| E7.F2.T2 Comentarios en vivo | Normal | **Insignia de no leídos** en la pestaña. |
| E1.F4 criterio de aceptación | — | Página `/dev/ui` (o Storybook) con los componentes en claro y oscuro. |

Fuera del MVP según la arquitectura: API REST `/api/v1`.

---

## 3. Móvil y experiencia de uso

- **Plan sigue muy largo en móvil.** El documento UI/UX propone Comentarios en su propia pestaña; el plan de ClickUp (E4.F4.T1) pedía 7 pestañas y hay 5. Decidir: mover Comentarios a una pestaña o colapsar secciones.

---

## 4. Rendimiento

- Medido: **221 KB** de JS inicial comprimido en `/login` (meta < 300 KB).
- Falta: **Lighthouse ≥ 90** en Performance y Accesibilidad en las pantallas clave (E10.F2.T3) y LCP < 2.5 s (RNF-01). Speed Insights dará el LCP real tras desplegar.

---

## 5. Pruebas y calidad

| Pendiente | Tarea ClickUp |
| --- | --- |
| E2E solo en Chromium. El plan pide matriz Chrome / Safari / Firefox + iOS / Android: añadir proyectos `webkit` y `firefox` a Playwright y una pasada manual en teléfonos. | E10.F2.T1 |
| **Husky + lint-staged** en pre-commit (hoy el formato solo se comprueba en el CI). | E1.F1.T2 |
| Regla ESLint `no-restricted-imports` que impida importar `features/*/…` sin pasar por su `index.ts` (hoy se respeta, pero nada lo obliga). | define-stack PR 4 |
| Regla ESLint que prohíba `next/image` en galería e historial (CLAUDE.md lo exige). | define-stack PR 8 |
| Registrar la decisión `strict_tdd` en `openspec`. | define-stack PR 11 |
| Sentry sin _source maps_ (trazas minificadas). Requiere `withSentryConfig` y `SENTRY_AUTH_TOKEN` en Vercel. | E1.F3.T3 |

---

## 6. Repositorio y herramientas

| Pendiente | Tarea ClickUp |
| --- | --- |
| `CONTRIBUTING.md` y plantillas de _issues_ (la de PR ya existe). | E1.F1.T3 |
| Script `gen:types` y regenerar `types.generated.ts` desde Staging; hoy se edita a mano. | E1.F2.T4 |
| Documento de responsables por módulo (uno por cada uno de los 12). | define-stack PR 4 |

---

## 7. Desviaciones del plan ya decididas

No son pendientes; conviene dejarlas anotadas en ClickUp para que nadie las reabra.

| Plan (ClickUp / documentos) | Implementado | Motivo |
| --- | --- | --- |
| Fotos en Supabase Storage con bucket y políticas (E9.F1.T1, define-stack PR 8) | Cloudinary con firma en el servidor | CLAUDE.md y `design.md` §7 |
| Compresión a 1920 px WebP + miniatura 400 px en un Web Worker | 1600 px en el navegador; Cloudinary genera las variantes | Cloudinary transforma en el servidor |
| Reordenar cronograma con arrastrar y soltar (E5.F1.T3) | Orden por hora | Nota RF-402 en API y UI/UX |
| Selector de moneda (RF-701) | Solo USD | Nota RF-701 en API y UI/UX |
| Paleta teal + Inter (E1.F4.T1) | Noche serena: lavanda, Manrope + Instrument Serif | `docs/design-system.md` |
| React Hook Form en los formularios | Server actions con `useActionState` y Zod en el servidor | Patrón de Next.js App Router |
| Gráfica con Recharts (E10.F1.T2) | Barras propias en CSS | Menos peso en el bundle |

---

## 8. Base de datos

- 16 índices marcados "sin uso" en Staging: normal con pocos datos; revisar tras un mes en Producción.

---

## 9. ClickUp desactualizado

- 86 de 91 tareas siguen en _backlog_; 4 en _in development_ y 1 en _testing_. Las 13 de **define-stack: Foundation** también.
- Propuesta: pasar a _Done_ las tareas cubiertas por los PR #1 – #37 y dejar abiertas solo las de las secciones 1, 2, 5 y 6 de este documento, con su enlace al PR o al punto correspondiente.

---

## Orden recomendado

1. Fusionar #37 y corregir lo que marque su CI (axe con sesión, votos en vivo).
2. Producción: reactivar, migrar, verificar; contraseñas filtradas; protección de `main`; secretos y variables.
3. Legal y SEO (bloquea el lanzamiento público).
4. Reparto al pagador de los centavos sobrantes, error boundary por pestaña y tareas vencidas (cambios pequeños con impacto directo).
5. Home del grupo con Próximas / Pasadas, vista previa de la invitación, motivo de cancelación.
6. Lighthouse, matriz de navegadores, Husky y reglas de ESLint.
7. Lo de prioridad Normal: aviso de solape, actividad en curso, swipe, GroupSwitcher, asistencia en vivo, insignia de no leídos.
8. Actualizar ClickUp.

## Fuera del MVP (según el PRD)

Notificaciones push o por correo, recordatorios de eventos, reacciones y menciones en comentarios, álbum con detección de duplicados y API REST pública `/api/v1`.
