# 01-PRD-Parking-Tracker.docx

**PARKING TRACKER**
**Product Requirements Document**
PRD — Plataforma de organización de salidas entre amigos
**Versión:** 1.0
**Fecha:** 12 de junio de 2026
**Estado:** Aprobado para desarrollo
**Autor:** Equipo Parking Tracker
**Contenido**
# 1\. Visión del Producto
Parking Tracker es una plataforma web colaborativa que centraliza toda la organización de salidas, eventos y actividades de un grupo de amigos en un solo lugar: planificación, confirmación de asistencia, cronogramas, votaciones, gastos compartidos, fotos y estadísticas.
**Declaración de visión:** "Ser el punto de encuentro digital donde los grupos de amigos planifican, viven y recuerdan sus salidas, eliminando el caos de los chats grupales."
# 2\. Problema que Resuelve
Hoy la organización de salidas grupales ocurre dispersa en chats de WhatsApp, hojas de cálculo y notas sueltas. Esto genera problemas concretos:
*   **Información perdida:** fechas, lugares y acuerdos quedan enterrados en cientos de mensajes.
*   **Asistencia incierta:** nadie sabe con certeza quién va, lo que dificulta reservas y presupuestos.
*   **Decisiones lentas:** elegir destino o actividad deriva en discusiones interminables sin mecanismo de votación.
*   **Cuentas confusas:** los gastos compartidos se calculan a mano y generan fricción ("¿quién pagó qué?").
*   **Recuerdos dispersos:** las fotos quedan repartidas en los teléfonos de cada uno.
*   **Sin historial:** no existe registro de salidas pasadas ni de la participación de cada miembro.
# 3\. Objetivos
## 3.1 Objetivos de producto
*   Centralizar la planificación completa de una salida (evento, agenda, decisiones, gastos, fotos) en una sola herramienta.
*   Reducir el tiempo de coordinación de una salida típica de días de chat a minutos.
*   Dar visibilidad inmediata de quién asiste y cuánto debe cada uno.
*   Construir memoria del grupo: historial, galería y estadísticas de participación.
## 3.2 Objetivos de negocio/proyecto
*   Lanzar un MVP funcional en 12 semanas con un equipo de 8 desarrolladores.
*   Validar adopción con al menos 5 grupos activos en el primer mes post-lanzamiento.
*   Mantener coste de infraestructura cercano a cero usando tiers gratuitos de Supabase y Vercel.
# 4\. Público Objetivo
**Usuario primario:** grupos de amigos de 4 a 20 personas, de 18 a 40 años, habituados a apps móviles/web, que organizan salidas recurrentes (cenas, viajes cortos, cumpleaños, partidos, escapadas).
**Personas:**

| Persona | Perfil | Necesidad principal |
| ---| ---| --- |
| "El Organizador" (Ana, 28) | Siempre arma el plan, crea el grupo de chat, persigue confirmaciones | Confirmaciones claras y agenda sin perseguir a nadie |
| "El Tesorero" (Luis, 31) | Paga por adelantado y luego cobra a todos | Registro de gastos y saldos automáticos |
| "El Participante" (Sofía, 25) | Se suma a los planes, vota y comparte fotos | Ver rápido qué hay, cuándo y confirmar en un clic |

# 5\. Casos de Uso

| ID | Caso de uso | Actor | Descripción |
| ---| ---| ---| --- |
| CU-01 | Registrarse e iniciar sesión | Usuario | Crear cuenta con email/contraseña o Google y acceder a la plataforma |
| CU-02 | Crear grupo e invitar amigos | Organizador | Crear un grupo y compartir un código/enlace de invitación |
| CU-03 | Crear salida/evento | Organizador | Definir título, descripción, lugar, fecha y publicar al grupo |
| CU-04 | Confirmar asistencia | Miembro | Responder Voy / Quizás / No voy a un evento |
| CU-05 | Gestionar cronograma | Organizador | Crear agenda de actividades con horarios dentro del evento |
| CU-06 | Proponer actividad | Miembro | Sugerir una actividad para el evento |
| CU-07 | Votar | Miembro | Participar en votaciones (destino, actividad, fecha) y ver resultados |
| CU-08 | Registrar gasto compartido | Miembro | Cargar un gasto, definir cómo se divide y ver saldos por persona |
| CU-09 | Gestionar lista de tareas | Miembro | Crear y asignar tareas previas al evento (comprar hielo, reservar) |
| CU-10 | Comentar | Miembro | Conversar en el hilo de comentarios de cada evento |
| CU-11 | Subir fotos | Miembro | Compartir fotos en la galería del evento finalizado |
| CU-12 | Consultar historial | Miembro | Ver eventos pasados con su información, gastos y fotos |
| CU-13 | Ver estadísticas | Miembro | Consultar participación, asistencias y gastos del grupo |

# 6\. User Stories
## 6.1 Autenticación y grupos
### US-01 — Como usuario nuevo, quiero registrarme con email o Google, para acceder a la plataforma de forma segura
**Criterios de aceptación:**
*   Puedo registrarme con email/contraseña (verificación por email) o con Google OAuth.
*   Al registrarme se crea mi perfil con nombre y avatar editables.
*   Si las credenciales son inválidas veo un mensaje de error claro.
### US-02 — Como organizador, quiero crear un grupo e invitar por enlace, para reunir a mis amigos en un espacio privado
**Criterios de aceptación:**
*   Puedo crear un grupo con nombre y foto.
*   El sistema genera un código de invitación único compartible.
*   Quien usa el enlace y tiene cuenta se une como miembro; el creador es administrador.
*   Solo los miembros del grupo ven su contenido.
## 6.2 Eventos y asistencia
### US-03 — Como organizador, quiero crear una salida con fecha, lugar y descripción, para que todos tengan la información en un solo lugar
**Criterios de aceptación:**
*   Formulario con título (obligatorio), descripción, lugar, fecha/hora inicio y fin.
*   El evento queda visible para todos los miembros del grupo.
*   Puedo editarlo o cancelarlo; los cambios se reflejan para todos.
### US-04 — Como miembro, quiero confirmar mi asistencia en un clic, para que el organizador sepa con cuántos contar
**Criterios de aceptación:**
*   Puedo responder Voy / Quizás / No voy y cambiar mi respuesta hasta el inicio del evento.
*   Veo el listado de confirmados, indecisos y ausentes con contador.
## 6.3 Cronograma, propuestas y votaciones
### US-05 — Como organizador, quiero armar un cronograma de actividades, para estructurar el día de la salida
**Criterios de aceptación:**
*   Puedo añadir ítems con título, hora de inicio/fin y descripción, y reordenarlos.
*   El cronograma se muestra ordenado cronológicamente en el detalle del evento.
### US-06 — Como miembro, quiero proponer actividades y votar, para que el plan se decida democráticamente
**Criterios de aceptación:**
*   Puedo crear una propuesta con título y descripción.
*   Puedo crear una votación con 2 a 10 opciones y fecha de cierre.
*   Un voto por usuario (o múltiple si la votación lo permite); puedo cambiarlo mientras esté abierta.
*   Los resultados se ven en tiempo real y la opción ganadora queda destacada al cerrar.
## 6.4 Gastos compartidos
### US-07 — Como miembro, quiero registrar gastos y dividirlos, para saber cuánto debe cada uno sin cálculos manuales
**Criterios de aceptación:**
*   Puedo registrar un gasto con descripción, monto, pagador y participantes.
*   División en partes iguales por defecto, con opción de montos personalizados.
*   Veo el balance por persona (cuánto debo / cuánto me deben) y un resumen de transferencias sugeridas.
*   Puedo marcar deudas como saldadas.
## 6.5 Recuerdos y estadísticas
### US-08 — Como miembro, quiero subir fotos al evento, para que los recuerdos queden en un solo lugar
**Criterios de aceptación:**
*   Puedo subir imágenes (JPG/PNG/WebP, máx. 10 MB) a la galería del evento.
*   La galería muestra miniaturas con vista ampliada y autor.
*   Puedo eliminar mis propias fotos; los administradores pueden eliminar cualquiera.
### US-09 — Como miembro, quiero ver historial y estadísticas del grupo, para conocer la actividad y participación de todos
**Criterios de aceptación:**
*   Veo eventos pasados con su información completa en modo solo lectura.
*   Veo ranking de asistencia, número de eventos por mes y gasto total por evento.
# 7\. Alcance del MVP
## 7.1 Incluido en el MVP

| Módulo | Alcance MVP |
| ---| --- |
| Autenticación | Email/contraseña + Google OAuth, perfil básico |
| Grupos | Crear grupo, invitar por código/enlace, roles admin/miembro |
| Eventos | CRUD de eventos, estados (borrador/publicado/cancelado/finalizado) |
| Asistencia | RSVP Voy/Quizás/No voy con listado de confirmados |
| Cronograma | Ítems de agenda ordenables con horarios |
| Propuestas y votaciones | Propuestas simples + votaciones de opción única/múltiple con cierre |
| Comentarios | Hilo de comentarios por evento (1 nivel de respuesta) |
| Gastos | Registro, división igual/personalizada, balances y liquidación manual |
| Tareas | Lista de tareas por evento con asignación y estado |
| Galería | Subida de fotos por evento con Supabase Storage |
| Historial | Vista de eventos finalizados |
| Estadísticas | Asistencia por miembro, eventos por mes, gastos por evento |

## 7.2 Fuera del alcance del MVP
*   Aplicación móvil nativa (la web será responsive).
*   Notificaciones push y emails transaccionales avanzados (solo email de verificación).
*   Pagos integrados (Stripe/PayPal) para saldar deudas.
*   Chat en tiempo real (se cubre con comentarios).
*   Integración con calendarios externos (Google Calendar) y mapas interactivos.
*   Multi-idioma (MVP solo en español).
# 8\. Funcionalidades Futuras (Post-MVP)

| Prioridad | Funcionalidad | Valor |
| ---| ---| --- |
| Alta | Notificaciones push/email (recordatorios de evento, cierres de votación) | Re-engagement y menos olvidos |
| Alta | Exportar evento a Google Calendar / archivo .ics | Integración con la rutina del usuario |
| Media | Liquidación de gastos con enlaces de pago (Yappy/Stripe) | Cierre del ciclo de gastos |
| Media | Plantillas de eventos recurrentes | Ahorro de tiempo para grupos activos |
| Media | Reacciones y menciones en comentarios | Mayor interacción social |
| Baja | Álbum compartido con reconocimiento de duplicados | Mejor experiencia de galería |
| Baja | Gamificación (insignias por asistencia) | Retención a largo plazo |

# 9\. Métricas de Éxito

| Métrica | Definición | Objetivo (3 meses) |
| ---| ---| --- |
| Grupos activos | Grupos con ≥1 evento creado en los últimos 30 días | ≥ 5 grupos |
| Tasa de RSVP | % de miembros invitados que responden asistencia | ≥ 70% |
| Eventos por grupo/mes | Promedio de eventos creados por grupo activo | ≥ 2 |
| Adopción de gastos | % de eventos con al menos 1 gasto registrado | ≥ 50% |
| Retención M1 | % de usuarios que vuelven al mes siguiente | ≥ 40% |
| Tiempo de organización | Tiempo desde creación del evento hasta 80% de RSVP | < 48 horas |

# 10\. Riesgos y Supuestos
## 10.1 Riesgos

| Riesgo | Impacto | Mitigación |
| ---| ---| --- |
| Baja adopción frente a WhatsApp (inercia) | Alto | UX de fricción mínima: invitación por enlace, RSVP en 1 clic |
| Alcance del MVP demasiado amplio para 12 semanas | Alto | Priorización estricta por sprint; gastos y galería son recortables a versión simple |
| Costes de Storage por fotos | Medio | Límite de 10 MB/foto, compresión en cliente, cuotas por grupo |
| Seguridad de datos privados del grupo | Alto | RLS en todas las tablas desde el día 1, revisión de políticas en QA |

## 10.2 Supuestos
*   Los grupos tienen un "organizador natural" que adoptará primero la herramienta.
*   El acceso será principalmente desde móvil: diseño mobile-first obligatorio.
*   Los tiers gratuitos de Supabase y Vercel cubren la carga del primer año.
# 11\. Próximos Pasos
1. Validar este PRD con el equipo y congelar el alcance del MVP.
2. Revisar el SRS y la arquitectura técnica (documentos 2 y 3).
3. Cargar la planificación en ClickUp (documento 8) y arrancar el Sprint 0.