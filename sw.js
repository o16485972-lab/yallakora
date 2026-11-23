/* yallaakora - Service Worker: تثبيت كتطبيق + عمل دون اتصال + إشعارات */
const CACHE = "kora-v21";
const SHELL = [
  "./", "./index.html", "./manifest.json", "./icon.svg",
  "./css/styles.css?v=13", "./js/config.js", "./js/data.js?v=2",
  "./js/streams.js", "./js/sources.js?v=2", "./js/live.js?v=3",
  "./js/enrich.js?v=6", "./js/app.js?v=21"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // لا نخزن بيانات ESPN/يوتيوب

  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); return res; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }))
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) =>
      clients.length ? clients[0].focus() : self.clients.openWindow("./")
    )
  );
});
