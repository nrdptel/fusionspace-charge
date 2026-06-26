// Service worker for offline use. High-power launches happen where there's no cell
// signal, and Charge is pure client-side math — so once it's been loaded online, it
// should work at the pad with no connection: the calculator, saved rockets, and the
// ground-test log (all localStorage) keep working.
//
// Strategy:
//   - navigations: network-first (an online visitor always gets fresh HTML), falling
//     back to the cached app shell when offline.
//   - other same-origin GETs (JS/CSS/fonts/icons): stale-while-revalidate, so assets
//     load instantly and refresh in the background.
// The cache name is versioned; old caches are cleared on activate.

const CACHE = "charge-v1";
const SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SHELL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(SHELL, { ignoreSearch: true })),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
