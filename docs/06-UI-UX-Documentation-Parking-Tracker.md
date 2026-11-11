# 06-UI-UX-Documentation-Parking-Tracker.docx

**PARKING TRACKER**
**UI/UX Documentation**
Sitemap, flujos de usuario, wireframes y sistema de componentes
**Versión:** 1.0
**Fecha:** 12 de junio de 2026
**Enfoque:** Mobile-first · WCAG 2.1 AA
**Contenido**
# 1\. Principios de Diseño
*   **Mobile-first:** el 80% del uso esperado es desde el teléfono; toda pantalla se diseña primero a 375 px.
*   **Cero fricción:** las acciones núcleo (confirmar asistencia, votar) se resuelven en 1 clic desde el dashboard.
*   **El evento es el centro:** toda la información de una salida vive en una sola pantalla con pestañas.
*   **Consistencia shadcn/ui:** un solo sistema de componentes, tema claro/oscuro, espaciado en escala de 4 px.
*   **Estados siempre diseñados:** cada vista define estado vacío, cargando (skeleton), error y éxito.
# 2\. Sitemap
/
├── /login · /register · /forgot-password · /reset-password \[públicas\]
├── /join/\[code\] \[invitación a grupo\]
└── (privadas, requieren sesión)
├── /groups \[grupos del usuario + próximas salidas y acciones rápidas\]
├── /profile \[editar perfil, cerrar sesión\]
└── /groups/\[groupId\]
├── (home) \[próximos eventos del grupo y su historial; crear salida en línea\]
├── /events/\[eventId\] \[detalle con 5 pestañas: ?section=plan|votaciones|gastos|tareas|fotos\]
│ ├── Plan (info, cronograma, notas, asistencia y comentarios)
│ ├── Votos (propuestas + polls)
│ ├── Gastos (lista + balances)
│ ├── Tareas (checklist)
│ └── Fotos (galería)
├── /stats \[participación y gastos\]
└── /settings \[grupo, miembros, invitación\]
# 3\. User Flows
## 3.1 Onboarding y primer grupo
Registro ──▶ Verificar email ──▶ Login ──▶ ¿Tiene grupos?
│
no ◀──────────────┴──────────────▶ sí
│ │
Pantalla vacía con 2 CTA /groups
├─ "Crear grupo" ─▶ form ─▶ compartir enlace
└─ "Tengo un código" ─▶ /join/\[code\] ─▶ grupo
## 3.2 Crear salida y conseguir confirmaciones
Organizador: Grupo ─▶ \[+ Nueva salida\] ─▶ Form (título, fecha, lugar)
─▶ Publicar ─▶ Detalle del evento

Miembro: Dashboard ─▶ tarjeta del evento ─▶ \[Voy\] \[Quizás\] \[No voy\]
─▶ contador de asistencia actualizado en vivo
## 3.3 Decidir actividad por votación
Miembro propone ─▶ pestaña Votaciones ─▶ \[+ Propuesta\]
Organizador ─▶ \[Crear votación\] (2-10 opciones, cierre opcional)
Miembros votan ─▶ resultados en tiempo real ─▶ cierre
─▶ opción ganadora destacada ─▶ \[Añadir al cronograma\]
## 3.4 Gastos: registrar y saldar
Pestaña Gastos ─▶ \[+ Gasto\] ─▶ monto, pagador, participantes
─▶ división igual (default) o personalizada ─▶ guardar
Vista Balance ─▶ "Debes $47.34 a Ana" ─▶ pagar por fuera
─▶ \[Marcar saldado\] ─▶ balance en cero ✓
Nota MVP (RF-701): todos los montos se registran y muestran en USD, sin selector de moneda por grupo.
## 3.5 Después de la salida
Evento pasa a "Finalizado" ─▶ banner "¡Sube tus fotos!"
─▶ Galería: subir/ver fotos ─▶ la salida queda en el historial de la home del grupo
─▶ /stats refleja asistencia y gasto del evento
# 4\. Wireframes Textuales
## 4.1 Dashboard (móvil, 375 px)
┌─────────────────────────────────┐
│ ☰ Parking Tracker (🔔)(👤)│
├─────────────────────────────────┤
│ Hola, Made 👋 │
│ PRÓXIMAS SALIDAS │
│ ┌─────────────────────────────┐ │
│ │ 🏖 Asado en la playa │ │
│ │ Sáb 4 jul · 16:00 · 8 van │ │
│ │ \[✓ Voy\] \[? Quizás\] \[✗ No\] │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🎂 Cumple de Luis │ │
│ │ Vie 17 jul · pendiente RSVP │ │
│ └─────────────────────────────┘ │
│ MIS GRUPOS │
│ (●) Los de siempre 12 miembros│
│ (●) Crew del trabajo 6 miembros│
│ │
│ \[+ Nueva salida\] │
└─────────────────────────────────┘
## 4.2 Detalle de evento
┌─────────────────────────────────┐
│ ← Asado en la playa │
│ 📅 Sáb 4 jul 16:00 📍 Sta Clara│
│ Asistencia: 8 ✓ · 2 ? · 1 ✗ │
│ \[✓ Voy\] \[? Quizás\] \[✗ No voy\] │
├─────────────────────────────────┤
│ Plan│Votos│Gastos│Tareas│Fotos│ ← tabs scrollables
├─────────────────────────────────┤
│ (contenido de la pestaña activa)│
│ │
│ Ej. Gastos: │
│ Total: $142.00 · por persona: │
│ $47.33 │
│ ─ Carne y carbón $85.50 Ana │
│ ─ Bebidas $56.50 Luis │
│ ┌───────────────────────────┐ │
│ │ Tu balance: -$47.34 │ │
│ │ → Pagar $38.17 a Ana │ │
│ │ → Pagar $9.17 a Luis │ │
│ └───────────────────────────┘ │
│ \[+ Añadir gasto\] │
└─────────────────────────────────┘
## 4.3 Crear evento
┌─────────────────────────────────┐
│ ← Nueva salida │
│ Título\* \[\_\_\_\_\_\_\_\_\_\_\_\_\_\_\] │
│ Descripción \[\_\_\_\_\_\_\_\_\_\_\_\_\_\_\] │
│ Lugar \[\_\_\_\_\_\_\_\_\_\_\_\_\_\_\] │
│ Inicio\* \[📅 04/07\] \[🕐 16:00\] │
│ Fin \[📅 04/07\] \[🕐 23:00\] │
│ Portada \[ subir imagen 📷 \] │
│ │
│ \[Guardar borrador\] \[Publicar ▶\] │
└─────────────────────────────────┘
## 4.4 Estadísticas
┌─────────────────────────────────┐
│ ← Estadísticas · Los de siempre│
│ ┌──────────┐ ┌──────────┐ │
│ │ 14 │ │ $1,240 │ │
│ │ salidas │ │ gastado │ │
│ └──────────┘ └──────────┘ │
│ ASISTENCIA POR MIEMBRO │
│ Ana ████████████ 93% │
│ Luis ██████████ 79% │
│ Sofía ████████ 64% │
│ SALIDAS POR MES (barras) │
│ ▂ ▄ █ ▆ ▄ █ │
│ E F M A M J │
└─────────────────────────────────┘
# 5\. Inventario de Pantallas

| \# | Pantalla | Ruta | Prioridad |
| ---| ---| ---| --- |
| 1 | Login | /login | Must |
| 2 | Registro | /register | Must |
| 3 | Recuperar contraseña | /forgot-password · /reset-password | Must |
| 4 | Grupos del usuario (dashboard) | /groups | Must |
| 5 | Unirse a grupo (invitación) | /join/\[code\] | Must |
| 6 | Home de grupo (eventos + historial) | /groups/\[id\] | Must |
| 7 | Crear/editar evento | /groups/\[id\] (formulario en línea en la home) | Must |
| 8 | Detalle de evento (5 pestañas) | /groups/\[id\]/events/\[eid\] | Must |
| 9 | Estadísticas | /groups/\[id\]/stats | Must |
| 10 | Ajustes de grupo y miembros | /groups/\[id\]/settings | Must |
| 11 | Perfil de usuario | /profile | Must |
| 12 | Estados vacíos / 404 / error | (transversal) | Must |

Nota MVP (RF-402): el cronograma se ordena cronológicamente por \`starts_at\`; \`position\` solo desempata ítems que empiezan a la misma hora y no hay reordenamiento manual.

# 6\. Componentes Reutilizables
## 6.1 Base (shadcn/ui)
Button, Input, Textarea, Select, Calendar/DatePicker, Dialog, Sheet (móvil), Tabs, Card, Avatar + AvatarGroup, Badge, Skeleton, Toast (sonner), DropdownMenu, AlertDialog, Form (con React Hook Form), Progress, Tooltip.
## 6.2 Componentes de dominio

| Componente | Descripción | Usado en |
| ---| ---| --- |
| <EventCard> | Tarjeta de evento con fecha, lugar, contador RSVP y acciones rápidas | Dashboard, home de grupo, historial |
| <RsvpButtons> | Trío Voy/Quizás/No voy con estado optimista | EventCard, detalle de evento |
| <AttendanceList> | Avatares agrupados por estado con contadores | Detalle (Info) |
| <ScheduleTimeline> | Línea de tiempo vertical de ítems con horas | Pestaña Cronograma |
| <PollCard> | Votación con opciones, barras de resultado en vivo y cierre | Pestaña Votaciones |
| <ExpenseRow> / <ExpenseForm> | Fila de gasto y formulario con selector de división | Pestaña Gastos |
| <BalanceSummary> | Balance del usuario + transferencias sugeridas | Pestaña Gastos |
| <TaskItem> | Checkbox, responsable y fecha límite | Pestaña Tareas |
| <PhotoGrid> / <PhotoLightbox> | Grilla de miniaturas y visor ampliado | Pestaña Galería |
| <CommentThread> | Comentario + respuestas, editar/eliminar | Pestaña Comentarios |
| <StatBar> / <StatCard> | Barras de asistencia y tarjetas KPI | Estadísticas |
| <EmptyState> | Ilustración + mensaje + CTA | Todas las listas vacías |
| <GroupSwitcher> | Selector de grupo activo en el header | Layout privado |

# 7\. Tema Visual
*   **Color primario:** índigo profundo "Noche serena" — principal \#2E2A6B (claro) / \#B8B8FF (oscuro) para acción y marca. Periwinkle (\#6B5ED6 / \#9381FF) para "Quizás" y votos; jade (\#0E7F63 / \#5EE6BE) como único acento vivo (confirmaciones, "en vivo"); rojos solo para errores. Ver \`docs/design-system.md\` (tokens en \`src/app/design-tokens.css\`).
*   **Tipografía:** Manrope (variable) para texto e interfaz; Instrument Serif para títulos y cifras destacadas. Escala fluida con tokens \`--text-*\`.
*   **Radios y sombras:** tokens \`--radius-*\` y \`--shadow-*\`; densidad cómoda al pulgar (touch targets ≥ 44 px).
*   **Modo oscuro** desde el MVP (next-themes + variables CSS).
# 8\. Accesibilidad
*   Contraste AA en todos los pares texto/fondo (verificado con tooling en CI).
*   Navegación completa por teclado; foco visible; dialogs con focus-trap (Radix lo provee).
*   Labels y aria-\* en formularios; mensajes de error asociados con aria-describedby.
*   Imágenes de galería con alt generado (caption o "Foto de {autor}").