// Service worker mínimo: cachea el app shell para que la PWA abra al instante.
// La terminal en sí siempre es red (WebSocket), aquí no se cachea nada de eso.
const CACHE = 'hyprterm-v1'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return

  // Red primero, caché como fallback (para abrir la app con el PC apagado y ver la pantalla de offline)
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, copy))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
