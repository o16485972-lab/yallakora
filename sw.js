/* yallaakora - Service Worker: تثبيت كتطبيق + عمل دون اتصال + إشعارات */
/* FCM اختياري: يُفعّل فقط عند تمرير بيانات Firebase في رابط التسجيل */
const FCM_Q = new URLSearchParams(self.location.search);
const FCM_SENDER = FCM_Q.get("senderId");
const FCM_APP = FCM_Q.get("appId") || "";
if (FCM_SENDER) {
  try {
    importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");
    if (!firebase.apps.length) firebase.initializeApp({ messagingSenderId: FCM_SENDER, appId: FCM_APP });
    firebase.messaging().onBackgroundMessage((payload) => {
      const n = payload.notification || {};
      self.registration.showNotification(n.title || "yallaakora ⚽", {
        body: n.body || "", icon: "./icon.svg", badge: "./icon.svg", tag: "kora-fcm",
        data: payload.data || {}
      });
    });
  } catch (err) { /* FCM غير متاح بدون بيانات صحيحة */ }
}

/* Cloudflare Worker للإشعارات في الخلفية — يُمرَّر في رابط التسجيل */
const WORKER_URL = FCM_Q.get("worker") || "";

const CACHE = "kora-v26";
const SHELL = [
  "./", "./index.html", "./manifest.json", "./icon.svg",
  "./css/styles.css?v=15", "./js/config.js?v=3", "./js/data.js?v=3",
  "./js/streams.js", "./js/sources.js?v=2", "./js/live.js?v=3",
  "./js/enrich.js?v=6", "./js/app.js?v=26"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL).then(() => c.put("feed-since", new Response(String(Date.now())))))
    .then(() => self.skipWaiting()));
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

/* استقبال إشعار Web Push: النص يُجلب من /feed (لا حاجة لتشفير الحمولة) */
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    if (!WORKER_URL) return;
    try {
      const c = await caches.open(CACHE);
      const old = await c.match("feed-since");
      const since = old ? Number(await old.text()) : Date.now();
      const r = await fetch(WORKER_URL.replace(/\/$/, "") + "/feed?since=" + since, { cache: "no-store" });
      const j = await r.json();
      (j.items || []).filter((m) => Number(m.time) > since).forEach((m) => {
        self.registration.showNotification(m.title || "yallaakora ⚽", {
          body: m.body || "", icon: "./icon.svg", badge: "./icon.svg",
          tag: "kora-" + m.id, data: { url: m.url || "#/matches" }
        });
      });
      if (j.now) await c.put("feed-since", new Response(String(j.now)));
    } catch (_) {}
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  let target = "./";
  try {
    const raw = e.notification.data && e.notification.data.url;
    if (raw) { const u = new URL(raw, self.location.origin); if (u.origin === self.location.origin) target = u.pathname + u.search + u.hash; }
  } catch (_) {}
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (!clients.length) return self.clients.openWindow(target);
      const c = clients[0];
      return (target !== "./" ? c.navigate(target) : Promise.resolve()).then(() => c.focus());
    })
  );
});
