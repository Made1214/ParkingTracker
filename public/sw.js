// Service worker de Parking Tracker. Sin dependencias y deliberadamente corto.
//
// Regla dura: aquí NUNCA se guarda una respuesta autorizada. Las páginas, las
// rutas /api, Supabase y las imágenes firmadas van siempre a la red; cachearlas
// podría mostrar datos de un grupo a otra persona en un dispositivo compartido
// tras cerrar sesión. Solo se guardan recursos públicos e idénticos para todos:
// los estáticos con hash de Next y la pantalla sin conexión.
const VERSION = "v1";
const STATIC_CACHE = `pt-static-${VERSION}`;
const SHELL_CACHE = `pt-shell-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const SHELL = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function navigate(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(OFFLINE_URL)) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }
  // Contenido con hash en el nombre: inmutable y sin datos de nadie.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (SHELL.includes(url.pathname)) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(request)) ?? Response.error();
      }),
    );
  }
  // Todo lo demás (RSC, /api, imágenes firmadas) pasa directo a la red.
});
