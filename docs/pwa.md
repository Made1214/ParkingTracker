# PWA y tiempo real

Implementación de la fase 14. La especificación está en
[`pwa-delivery.md`](../openspec/changes/define-stack/specs/pwa-delivery.md) y el
diseño en [`design.md` §5–6](../openspec/changes/define-stack/design.md).

## Qué hay y dónde

| Pieza | Archivo |
| --- | --- |
| Manifest | `src/app/manifest.ts` (se sirve en `/manifest.webmanifest`) |
| Iconos 192, 512 y maskable | `public/icons/` (generados desde `src/app/icon.svg`) |
| Service worker | `public/sw.js` |
| Pantalla sin conexión | `public/offline.html` |
| Registro, aviso de conexión y bloqueo de envíos | `src/shared/pwa/pwa-runtime.tsx` |
| Invitación a instalar | `src/shared/pwa/install-prompt.tsx` |
| Instalación a demanda (perfil) | `src/shared/pwa/install-card.tsx` |
| Comentarios en vivo | `src/features/comments/components/comments-realtime.tsx` |

## Service worker

Sin dependencias. Solo se registra en producción.

| Petición | Estrategia |
| --- | --- |
| `/_next/static/*` | Cache-first (nombres con hash, inmutables) |
| Navegaciones | Solo red; si falla, `offline.html` |
| RSC, `/api/*`, Supabase, imágenes firmadas | Solo red, nunca se guardan |

**Nunca se guarda una respuesta autorizada.** Por eso una pantalla ya visitada
no se reabre sin conexión con sus datos: se muestra `offline.html`, que se
recarga sola al volver la red. Guardar páginas arriesgaría mostrar datos de un
grupo a otra persona en un dispositivo compartido.

Al cambiar qué se precachea, subir `VERSION` en `public/sw.js`.

## Sin conexión

- Aparece un aviso fijo mientras no hay red.
- Cualquier envío de formulario se detiene antes de llegar a React y se avisa de
  que no se envió nada; el formulario conserva lo escrito.

## Invitación a instalar

- Solo dentro de una salida y a partir de la **segunda** salida abierta. Nunca
  en la primera carga ni en el enlace de invitación.
- Al descartarla espera 14 días; tras dos descartes no vuelve a salir sola.
- En **Mi perfil → Instalar la app** siempre se puede instalar.
- Chromium usa `beforeinstallprompt`. iOS no tiene instalación programática: se
  muestran los pasos «Compartir → Añadir a pantalla de inicio».
- No se pide permiso de notificaciones (fuera del MVP).

## Tiempo real

Realtime solo avisa; los datos se vuelven a pedir al servidor (`router.refresh()`),
donde RLS decide qué se ve.

- `comments` está en la publicación `supabase_realtime`
  (`20261110220341_comments_realtime.sql`).
- **El canal se abre después de `client.realtime.setAuth()`.** Si se une antes de
  que el cliente cargue la sesión, entra como anónimo y RLS descarta todos los
  avisos sin error. Aplica a cualquier canal nuevo.
- Los `DELETE` viajan solo con la clave primaria y no se pueden filtrar por
  salida: se comparan con los comentarios en pantalla.
- Un sondeo cada 30 s cubre avisos perdidos.

## Verificación

Instalabilidad (Chrome): DevTools → Application → Manifest, sin errores y con
«Installable».

Sin conexión: con la app de producción (`pnpm build && pnpm start`), DevTools →
Network → Offline; recargar muestra «Estás sin conexión» y enviar un formulario
muestra el aviso sin perder el texto.

Requisito previo de Web Push en iOS 16.4+ (las notificaciones no están
implementadas):

1. Abrir la app desplegada por HTTPS en Safari e instalarla con «Compartir →
   Añadir a pantalla de inicio».
2. Abrirla desde el icono: debe verse sin la barra de Safari
   (`display: standalone`).
3. Con el iPhone conectado a un Mac, Safari → Desarrollo → inspeccionar la app y
   comprobar en la consola:
   - `navigator.standalone === true`
   - `"PushManager" in window === true`
   - `(await navigator.serviceWorker.ready).pushManager !== undefined`

   En una pestaña normal de Safari `PushManager` no existe: solo la app instalada
   cumple el requisito.
