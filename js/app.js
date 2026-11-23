/* ============================================================
   yallaakora - منطق التطبيق
   ============================================================ */
(function () {
  "use strict";

  let D = window.KORA_DATA;
  const view = document.getElementById("view");
  const modalRoot = document.getElementById("modalRoot");
  const searchOverlay = document.getElementById("searchOverlay");
  const searchInput = document.getElementById("searchInput");
  const toastEl = document.getElementById("toast");

  const state = {
    homeMatchDay: "today",
    newsFilter: "الكل",
    newsShown: 8,
    statsTab: "scorers",
    showFavorites: false,
    liveMinute: 74,
    toastTimer: null
  };

  /* ================= الميزات الجديدة ================= */
  const CFG = window.KORA_CONFIG || {};
  const CITIES = (CFG.cities && CFG.cities.length) ? CFG.cities : [{ key: "cairo", label: "القاهرة", tz: "Africa/Cairo" }];
  const getCity = () => CITIES.find((c) => c.key === store.get("city", CFG.defaultCity || "cairo")) || CITIES[0];
  const cityTime = (iso, fallback) => {
    if (!iso) return fallback || "";
    const d = new Date(iso);
    if (isNaN(d)) return fallback || "";
    try { return new Intl.DateTimeFormat("ar-EG", { hour: "2-digit", minute: "2-digit", timeZone: getCity().tz }).format(d); }
    catch (_) { return fallback || ""; }
  };
  const matchTime = (m) => cityTime(m && m.iso, m && m.time);

  /* --- نظام النقاط والمستويات --- */
  const LEVELS = [
    { at: 0, name: "مشجع جديد", badge: "⚽" },
    { at: 25, name: "متابع شغوف", badge: "🔥" },
    { at: 75, name: "خبير كرة", badge: "🎯" },
    { at: 150, name: "أسطورة المدرجات", badge: "🏆" }
  ];
  const getPoints = () => Number(store.get("points", 0)) || 0;
  const levelInfo = () => {
    const p = getPoints();
    let lvl = LEVELS[0];
    LEVELS.forEach((x) => { if (p >= x.at) lvl = x; });
    const next = LEVELS.find((x) => x.at > p);
    return { ...lvl, points: p, next: next ? next.at : null };
  };
  function award(n, reason) {
    if (!n || n <= 0) return;
    store.set("points", getPoints() + n);
    toast("+" + n + " نقطة · " + reason);
  }

  /* --- إشعارات المتصفح (تعمل أثناء فتح الموقع) --- */
  const notifyOn = () => "Notification" in window && Notification.permission === "granted" && store.get("notify_on", false);
  function pushNotify(title, body) {
    if (!notifyOn()) return;
    try { new Notification(title, { body: body, icon: "./icon.svg", badge: "./icon.svg", tag: "kora" + Date.now() }); }
    catch (_) {}
  }
  function checkKickoffs() {
    if (!notifyOn()) return;
    const favs = getFavs();
    const sent = store.get("notified", []);
    const now = Date.now();
    const before = Number((CFG.notifications || {}).minutesBefore || 15) * 60000;
    const soon = [...((D.matches && D.matches.today) || []), ...((D.matches && D.matches.tomorrow) || [])]
      .filter((m) => {
        const t = m.iso ? Date.parse(m.iso) : 0;
        return t && t - now > 0 && t - now <= before && !sent.includes(m.id);
      })
      .filter((m) => !favs.length || favs.includes(String(m.home)) || favs.includes(String(m.away)));
    if (!soon.length) return;
    soon.forEach((m) => pushNotify("⚽ مباراة تبدأ قريباً", (D.teams[m.home] || {}).name + " × " + (D.teams[m.away] || {}).name + " — " + matchTime(m) + " · " + getCity().label));
    store.set("notified", [...sent, ...soon.map((m) => m.id)].slice(-200));
  }

  /* --- Firebase Cloud Messaging (يُفعّل تلقائياً عند وجود البيانات في config.js) --- */
  let fcmToken = "";
  let fcmState = "off";
  const fcmConfigured = () => {
    const f = CFG.firebase || {};
    return !!(f.apiKey && f.messagingSenderId && f.appId && f.vapidKey);
  };
  const getFunctionsUrl = () => store.get("functions_url", CFG.functionsUrl || "");
  const getWorkerUrl = () => store.get("worker_url", CFG.workerUrl || "");
  const getVapidKey = () => store.get("vapid_public", CFG.vapidPublicKey || "");
  const getAiEndpoint = () => store.get("ai_endpoint", (CFG.ai || {}).endpoint || "");
  const fcmStatusText = () => ({
    off: "غير مُعدّ", ready: "جاهز ✔", denied: "إذن مرفوض", error: "تعذّر الاتصال", loading: "جارٍ التهيئة..."
  })[fcmState] || fcmState;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error("script load failed: " + src));
      document.head.appendChild(s);
    });
  }

  async function initFCM() {
    if (!fcmConfigured() || !("Notification" in window)) return;
    fcmState = "loading";
    try {
      await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
      await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");
      const f = CFG.firebase;
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp({ apiKey: f.apiKey, messagingSenderId: f.messagingSenderId, appId: f.appId });
      }
      const messaging = window.firebase.messaging();
      if (Notification.permission === "default") await Notification.requestPermission();
      if (Notification.permission !== "granted") { fcmState = "denied"; return; }
      fcmToken = await messaging.getToken({ vapidKey: f.vapidKey });
      store.set("fcm_token", fcmToken);
      fcmState = "ready";
      const fn = getFunctionsUrl();
      if (fn) {
        fetch(fn.replace(/\/$/, "") + "/registerToken", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: fcmToken, city: getCity().key, favorites: getFavs() })
        }).catch(() => {});
      }
      messaging.onMessage((p) => {
        const n = p.notification || {};
        pushNotify(n.title || "yallaakora ⚽", n.body || "");
      });
      if ((location.hash || "").includes("settings")) renderSettingsPage();
    } catch (err) {
      fcmState = "error";
      console.warn("FCM init failed:", err);
    }
  }

  /* --- Web Push عبر Cloudflare Worker (بدون Firebase وبطاقة) --- */
  let webpushState = "off";
  const webpushStatusText = () => ({
    off: "غير مُعدّ", ready: "مفعّل ✔", denied: "إذن مرفوض", error: "تعذّر الاشتراك", loading: "جارٍ التفعيل..."
  })[webpushState] || webpushState;

  function urlB64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  async function initWebPush() {
    const worker = getWorkerUrl();
    const key = getVapidKey();
    if (!worker || !key || !("PushManager" in window) || !("serviceWorker" in navigator)) return;
    webpushState = "loading";
    try {
      if (Notification.permission === "default") await Notification.requestPermission();
      if (Notification.permission !== "granted") { webpushState = "denied"; return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(key)
        });
      }
      let id = store.get("webpush_id", "");
      if (!id) { id = "wp_" + Math.random().toString(36).slice(2) + Date.now().toString(36); store.set("webpush_id", id); }
      await fetch(worker.replace(/\/$/, "") + "/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, endpoint: sub.endpoint, city: getCity().key, favorites: getFavs() })
      });
      webpushState = "ready";
      store.set("webpush_on", true);
      if ((location.hash || "").includes("settings")) renderSettingsPage();
    } catch (err) {
      webpushState = "error";
      console.warn("Web Push init failed:", err);
    }
  }

  /* --- SEO ديناميكي لكل صفحة ومقال --- */
  function setSEO(o) {
    o = o || {};
    const title = o.title ? o.title + " | yallaakora" : "yallaakora | أخبار ومباريات ونتائج كرة القدم";
    const desc = o.desc || "نتائج حية وأخبار وتغطية دقيقة بدقيقة لكل البطولات العربية والعالمية.";
    document.title = title;
    const setMeta = (sel, attr, val) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val); };
    setMeta('meta[name="description"]', "content", desc);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:type"]', "content", o.type || "website");
    setMeta('meta[property="og:url"]', "content", location.href);
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", desc);
    if (o.image) {
      setMeta('meta[property="og:image"]', "content", o.image);
      setMeta('meta[name="twitter:image"]', "content", o.image);
    }
    setMeta('link[rel="canonical"]', "href", (CFG.siteUrl || location.origin) + location.pathname + location.hash);
    let ld = document.getElementById("ldPage");
    if (!ld) { ld = document.createElement("script"); ld.type = "application/ld+json"; ld.id = "ldPage"; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify(o.schema || {
      "@context": "https://schema.org", "@type": "WebPage", "name": title,
      "description": desc, "inLanguage": "ar", "url": location.href
    });
  }

  /* --- مساحات إعلانية/رعاة (تُفعّل من config.js فقط) --- */
  let adsStarted = false;
  function adCfg() {
    const a = CFG.ads || {};
    return {
      enabled: store.get("ads_enabled", a.enabled || false),
      adsenseClient: store.get("ads_client", a.adsenseClient || ""),
      adsenseSlot: store.get("ads_slot", a.adsenseSlot || "")
    };
  }
  function initAds() {
    const a = adCfg();
    if (adsStarted || !a.enabled || !a.adsenseClient) return;
    adsStarted = true;
    const s = document.createElement("script");
    s.id = "adsbygooglejs"; s.async = true;
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(a.adsenseClient);
    s.crossOrigin = "anonymous";
    s.onload = () => { document.querySelectorAll(".adsbygoogle").forEach(() => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) {} }); };
    document.head.appendChild(s);
  }
  function adSlotHTML(slot) {
    const a = adCfg();
    if (a.enabled && a.adsenseClient && a.adsenseSlot) {
      const id = slot || a.adsenseSlot;
      return `<div class="ad-slot"><small>إعلان</small><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(a.adsenseClient)}" data-ad-slot="${esc(id)}" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;
    }
    const sponsors = [...(a.sponsors || []), ...(store.get("sponsors", []) || [])];
    if (sponsors.length) {
      return `<div class="sponsor-strip"><span>شركاء yallaakora</span>${sponsors.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${s.logo ? `<img src="${esc(s.logo)}" alt="${esc(s.name)}">` : esc(s.name)}</a>`).join("")}</div>`;
    }
    return "";
  }

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);

  const img = (src, alt, cls) =>
    `<div class="img-wrap ${cls || ""}"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="this.style.display='none'"></div>`;

  function streamWrap(inner, extra) {
    return `<div class="stream-wrap">${inner}<div class="stream-tools">${extra || ""}<button class="stream-fs" data-action="stream-fullscreen" title="ملء الشاشة" aria-label="ملء الشاشة">⛶</button></div></div>`;
  }

  function streamEmbed(url) {
    if (!url) return "";
    const u = String(url).trim();
    const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
    const isHls = /\.m3u8(\?|$)/i.test(u);
    if (yt) {
      return streamWrap(`<iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0" title="بث المباراة" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`);
    }
    if (isHls) {
      return streamWrap(`<video id="liveStreamVideo" data-src="${esc(u)}" controls playsinline></video>`,
        `<select class="hls-quality" disabled aria-label="جودة البث"><option>تلقائي</option></select>`);
    }
    if (/^https?:\/\//i.test(u)) {
      return streamWrap(`<iframe src="${esc(u)}" title="بث المباراة" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`);
    }
    return "";
  }

  function attachHls(url, v) {
    if (window.__koraHls) { try { window.__koraHls.destroy(); } catch (_) {} }
    const hls = new window.Hls();
    window.__koraHls = hls;
    hls.loadSource(url); hls.attachMedia(v);
    hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
      const sel = document.querySelector(".hls-quality");
      if (!sel || !hls.levels.length) return;
      sel.innerHTML = `<option value="-1">تلقائي</option>` + hls.levels.map((l, i) =>
        `<option value="${i}">${l.height ? l.height + "p" : "جودة " + (i + 1)}</option>`).join("");
      sel.disabled = false;
    });
  }

  function initStreamPlayer() {
    const v = document.getElementById("liveStreamVideo");
    if (!v) return;
    const url = v.dataset.src;
    if (!url) return;
    if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = url; return; }
    if (window.Hls && window.Hls.isSupported()) { attachHls(url, v); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js";
    s.onload = () => { if (window.Hls && window.Hls.isSupported()) attachHls(url, v); };
    document.head.appendChild(s);
  }

  const badge = (team, cls) => {
    const t = typeof team === "string" ? D.teams[team] : team;
    if (!t) return "";
    return `<span class="team-badge ${cls || ""}" style="--c1:${t.c1};--c2:${t.c2}">${t.logo ? `<img class="badge-img" src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ""}<span class="badge-code">${esc(t.code)}</span></span>`;
  };

  const num = (n) => new Intl.NumberFormat("ar-EG").format(n);

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("kora_" + key); return v ? JSON.parse(v) : fallback; }
      catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("kora_" + key, JSON.stringify(value)); } catch (_) {}
    }
  };

  const getFavs = () => (store.get("favorites", []) || []).map(String);
  const isFav = (id) => getFavs().includes(String(id));
  const getComments = () => store.get("comments", []) || [];

  function commentsHTML(key) {
    const list = getComments().filter((c) => c.key === key);
    return `<div class="comment-box" data-key="${esc(key)}">
      <div class="comment-list">${list.length ? list.map((c) => `<div class="comment-item">
        <div class="comment-avatar">${esc((c.name || "م").trim().charAt(0))}</div>
        <div class="comment-body"><b>${esc(c.name)}</b><span>${esc(c.date)}</span><p>${esc(c.text)}</p></div>
      </div>`).join("") : `<p class="modal-note">كن أول من يعلّق. شاركنا رأيك!</p>`}</div>
      <div class="comment-form">
        <input type="text" class="comment-name" placeholder="اسمك" maxlength="30" aria-label="اسمك" />
        <textarea class="comment-text" placeholder="اكتب تعليقك..." maxlength="400" rows="2" aria-label="تعليقك"></textarea>
        <button type="button" data-action="comment-submit" data-key="${esc(key)}">نشر التعليق</button>
      </div>
    </div>`;
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  function sectionHead(title, href, label) {
    return `<div class="section-head">
      <h2 class="section-title">${esc(title)}</h2>
      ${href ? `<a class="more-link" href="${href}">${esc(label || "المزيد")}</a>` : ""}
    </div>`;
  }

  /* ---------- header / footer ---------- */
  function initChrome() {
    const socialHTML = D.socials.map((s) =>
      `<a href="${s.href}" target="_blank" rel="noopener" title="${s.name}" aria-label="${s.name}">${esc(s.short)}</a>`
    ).join("");
    document.getElementById("topSocials").innerHTML = socialHTML;
    document.getElementById("footerSocials").innerHTML = socialHTML;

    document.getElementById("todayDate").textContent =
      "اليوم، " + new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    document.getElementById("copyYear").textContent = new Date().getFullYear();
    const cityPill = document.getElementById("cityPill");
    if (cityPill) cityPill.textContent = "📍 " + getCity().label;

    document.getElementById("mainNav").innerHTML = D.nav.map((n) =>
      `<a href="${n.href}" data-nav="${n.href}">${esc(n.label)}</a>`
    ).join("");

    const drawer = document.getElementById("mobileDrawer");
    drawer.innerHTML = `
      <div class="drawer-head">
        <span class="drawer-title">القائمة</span>
        <button class="icon-btn" id="drawerClose" aria-label="إغلاق">✕</button>
      </div>
      <div class="drawer-links">
        <a href="#/">الرئيسية <span>‹</span></a>
        ${D.nav.map((n) => `<a href="${n.href}">${esc(n.label)} <span>‹</span></a>`).join("")}
      </div>
      <div class="drawer-socials">
        <h4 style="font-size:13px;margin-bottom:8px">تابعنا على</h4>
        <div class="socials">${socialHTML}</div>
      </div>`;

    const burger = document.getElementById("burgerBtn");
    const overlay = document.getElementById("drawerOverlay");
    const closeDrawer = () => { drawer.classList.remove("open"); overlay.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); };
    burger.addEventListener("click", () => {
      drawer.classList.add("open"); overlay.classList.add("open"); burger.setAttribute("aria-expanded", "true");
    });
    overlay.addEventListener("click", closeDrawer);
    drawer.addEventListener("click", (e) => { if (e.target.closest("a")) closeDrawer(); });
    document.getElementById("drawerClose").addEventListener("click", closeDrawer);

    document.getElementById("footerCols").innerHTML = D.footerCols.map((col) =>
      `<div><h4>${esc(col.title)}</h4>${col.links.map((l) => `<a href="${hrefFor(l)}">${esc(l)}</a>`).join("")}</div>`
    ).join("");

    // search
    document.getElementById("searchBtn").addEventListener("click", openSearch);
    document.getElementById("searchClose").addEventListener("click", closeSearch);
    searchOverlay.addEventListener("click", (e) => { if (e.target === searchOverlay) closeSearch(); });
    searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeSearch(); closeModal(); }
      if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); openSearch(); }
    });

    document.getElementById("notifyForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("notifyEmail");
      if (!email.checkValidity()) { toast("من فضلك أدخل بريداً إلكترونياً صحيحاً"); return; }
      const list = store.get("notify", []);
      if (list.includes(email.value)) toast("أنت مشترك بالفعل في خدمة الإشعارات");
      else { list.push(email.value); store.set("notify", list); toast("تم الاشتراك بنجاح!"); }
      email.value = "";
    });
  }

  function hrefFor(label) {
    const map = {
      "المباريات": "#/matches", "الأخبار": "#/news", "دوريات وبطولات": "#/leagues",
      "مالتيميديا": "#/media", "الانتقالات": "#/transfers", "فانتازي": "#/fantasy",
      "الدوري المصري": "#/egypt", "الدوري الإنجليزي": "#/leagues?league=الدوري%20الإنجليزي",
      "الدوري الإسباني": "#/leagues?league=الدوري%20الإسباني", "دوري أبطال أفريقيا": "#/leagues?league=دوري%20أبطال%20أفريقيا",
      "الدوري السعودي": "#/leagues?league=الدوري%20السعودي", "من نحن": "#/about",
      "اتصل بنا": "#/contact", "للإعلان معنا": "#/advertise", "سياسة الخصوصية": "#/policy",
      "المصادر الرسمية": "#/sources", "الناقلون الرسميون": "#/broadcasters",
      "الملخص اليومي": "#/brief", "الإعدادات والإشعارات": "#/settings", "لوحة التحكم": "#/admin"
    };
    return map[label] || "#/";
  }

  function openSearch() {
    searchOverlay.classList.add("open");
    searchOverlay.setAttribute("aria-hidden", "false");
    setTimeout(() => searchInput.focus(), 60);
    renderSearchResults("");
  }
  function closeSearch() {
    searchOverlay.classList.remove("open");
    searchOverlay.setAttribute("aria-hidden", "true");
  }

  function renderSearchResults(q) {
    const box = document.getElementById("searchResults");
    const term = q.trim().toLowerCase();
    if (!term) {
      box.innerHTML = `<div class="search-empty">اكتب كلمة للبحث في الأخبار والفرق والمباريات</div>`;
      return;
    }
    const newsRes = D.news.filter((n) => (n.title + n.category + n.excerpt).toLowerCase().includes(term)).slice(0, 8);
    const teamRes = Object.values(D.teams).filter((t) => t.name.toLowerCase().includes(term)).slice(0, 6);
    const html = [];
    if (newsRes.length) {
      html.push(`<div style="padding:6px 10px;font-size:11px;font-weight:800;color:var(--muted)">الأخبار</div>`);
      newsRes.forEach((n) => html.push(`
        <div class="search-result" data-action="article" data-id="${n.id}">
          ${img(n.image, n.title)}
          <div><small>${esc(n.category)}</small><h4>${esc(n.title)}</h4></div>
        </div>`));
    }
    if (teamRes.length) {
      html.push(`<div style="padding:10px 10px 6px;font-size:11px;font-weight:800;color:var(--muted)">الفرق</div>`);
      teamRes.forEach((t) => html.push(`
        <div class="search-result" data-action="team" data-name="${esc(t.name)}">
          ${badge(t)}<div><small>فريق</small><h4>${esc(t.name)}</h4></div>
        </div>`));
    }
    box.innerHTML = html.join("") || `<div class="search-empty">لا توجد نتائج مطابقة لـ «${esc(q)}»</div>`;
  }

  /* ---------- shared pieces ---------- */
  function matchCard(m) {
    const h = D.teams[m.home], a = D.teams[m.away];
    const stateHTML = m.status === "live"
      ? `<span class="match-state is-live">مباشر ${esc(m.minute)}</span>`
      : m.status === "finished" ? `<span class="match-state">انتهت</span>` : `<span class="match-state">لم تبدأ</span>`;
    const score = `<div class="match-score"><span>${esc(m.hs)}</span><span class="sep">-</span><span>${esc(m.as)}</span></div>`;
    return `<div class="match-card" data-action="match" data-id="${m.id}">
      <div class="match-league"><span>${esc(m.league)}</span>${stateHTML}</div>
      <div class="match-row"><div class="team-side">${badge(h)}<span class="team-name">${esc(h.name)}</span></div>${score}</div>
      <div class="match-row"><div class="team-side away">${badge(a)}<span class="team-name">${esc(a.name)}</span></div></div>
      <div class="match-time ${m.status === "live" ? "live-time" : ""}">${m.status === "live" ? "جارية الآن" : esc(matchTime(m))}</div>
    </div>`;
  }

  function stripHTML(day, stripId) {
    const titles = { yesterday: "مباريات الأمس", today: "مباريات اليوم", tomorrow: "مباريات الغد" };
    const tabs = Object.keys(titles).map((d) =>
      `<button class="strip-tab ${d === day ? "active" : ""}" data-action="strip-tab" data-day="${d}" data-strip="${stripId}">${titles[d]}</button>`
    ).join("");
    return `<div class="matches-strip" id="${stripId}">
      <div class="strip-head">
        <div class="strip-tabs">${tabs}</div>
        <a class="more-link" href="#/matches">جميع المباريات</a>
      </div>
      <div class="strip-body">
        <button class="strip-nav prev" data-action="strip-scroll" data-dir="-1" aria-label="السابق">‹</button>
        <div class="strip-scroll">${D.matches[day].map(matchCard).join("")}</div>
        <button class="strip-nav next" data-action="strip-scroll" data-dir="1" aria-label="التالي">›</button>
      </div>
    </div>`;
  }

  function newsCard(n) {
    return `<article class="card news-item" data-action="article" data-id="${n.id}">
      ${img(n.image, n.title)}
      <div class="news-body">
        <span class="chip">${esc(n.category)}</span>
        <h3>${esc(n.title)}</h3>
        <div class="news-meta"><span>${esc(n.date)}</span><span>${esc(n.time)}</span></div>
      </div>
    </article>`;
  }

  function newsRow(n) {
    return `<article class="card news-row" data-action="article" data-id="${n.id}">
      ${img(n.image, n.title)}
      <div class="news-row-body">
        <span class="chip">${esc(n.category)}</span>
        <h3>${esc(n.title)}</h3>
        <p>${esc(n.excerpt)}</p>
        <div class="news-row-meta"><span>${esc(n.date)}</span><span>${esc(n.time)}</span><span>👁 ${num(n.views)}</span></div>
      </div>
    </article>`;
  }

  function featuredHTML() {
    const [main, ...side] = D.featured;
    const m = main.item;
    return `<section class="section">
      ${sectionHead("الأبرز اليوم", "#/news")}
      <div class="featured-grid">
        <div class="hero-card" data-action="article" data-id="${m.id}">
          ${img(m.image, m.title)}
          <div class="hero-content">
            <div class="hero-tags"><span class="chip dark">${esc(main.label)}</span><span class="time-meta">${esc(m.date)} - ${esc(m.time)}</span></div>
            <h2>${esc(m.title)}</h2>
            <p>${esc(m.excerpt)}</p>
          </div>
        </div>
        <div class="side-featured">
          ${side.map((f) => `<article class="card side-card" data-action="article" data-id="${f.item.id}">
            ${img(f.item.image, f.item.title)}
            <div class="side-card-body"><span class="chip">${esc(f.label)}</span><h3>${esc(f.item.title)}</h3><span class="time-meta">${esc(f.item.time)}</span></div>
          </article>`).join("")}
        </div>
      </div>
    </section>`;
  }

  function pollHTML() {
    const saved = store.get("poll_vote", null);
    const total = D.poll.options.reduce((s, o) => s + o.votes, 0) + (saved ? 1 : 0);
    const options = D.poll.options.map((o) => {
      const votes = o.votes + (saved === o.id ? 1 : 0);
      const pct = saved ? Math.round((votes / total) * 100) : 0;
      return `<div class="poll-option ${saved === o.id ? "selected" : ""}" data-action="poll-option" data-id="${o.id}">
        <span class="bar" style="width:${pct}%"></span>
        <span>${esc(o.label)}</span>
        <span class="poll-percent">${saved ? pct + "%" : ""}</span>
      </div>`;
    }).join("");
    return `<div class="poll-card" id="pollCard">
      <div class="poll-top"><h3 class="poll-title">استطلاع yallaakora</h3><span class="chip">📊</span></div>
      <p class="poll-q">${esc(D.poll.question)}</p>
      <div class="poll-options">${options}</div>
      <button class="vote-btn" data-action="vote" ${saved ? "disabled" : ""}>${saved ? "تم تسجيل تصويتك" : "تصويت"}</button>
      <p class="poll-hint">${saved ? "شكراً لمشاركتك! يمكنك تغيير رأيك" : "اختر إجابة ثم اضغط تصويت"}</p>
    </div>`;
  }

  function videoSpotHTML() {
    const n = D.news[14];
    return `<section class="section">
      ${sectionHead("مش كورة وبس")}
      <div class="video-spot" data-action="video" data-title="${esc(n.title)}" data-image="${esc(n.image)}">
        ${img(n.image, n.title)}
        <span class="play-circle">▶</span>
        <div class="video-spot-caption">${esc(n.title)}</div>
      </div>
    </section>`;
  }

  function statsHTML() {
    const tabs = [["scorers", "الهدافون"], ["table", "ترتيب الفرق"], ["upcoming", "المباريات القادمة"]];
    let body = "";
    if (state.statsTab === "scorers") {
      body = D.stats.scorers.map((s, i) => `<div class="rank-row">
        <span class="rank-num">${i + 1}</span>
        <span class="team-badge" style="--c1:${s.c1};--c2:${s.c2}">${esc(s.code)}</span>
        <span class="rank-name">${esc(s.name)}<small>${esc(s.team)}</small></span>
        <span class="rank-val">${s.goals}</span>
      </div>`).join("");
    } else if (state.statsTab === "table") {
      body = `<div class="table-scroll"><table class="mini-table">
        <thead><tr><th>#</th><th>الفريق</th><th>لعب</th><th>ف</th><th>ت</th><th>خ</th><th>نقاط</th></tr></thead>
        <tbody>${D.stats.table.map((t) => `<tr>
          <td>${t.pos}</td>
          <td><span class="team-cell">${badge(t)} ${esc(t.team)}</span></td>
          <td>${t.p}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td><b>${t.pts}</b></td>
        </tr>`).join("")}</tbody></table></div>`;
    } else {
      body = D.stats.upcoming.map((u) => `<div class="upcoming-row">
        <span class="tm"><span class="team-badge" style="--c1:${u.hc};--c2:#fff">${esc(u.home.charAt(0))}</span>${esc(u.home)}</span>
        <span class="when">${esc(cityTime(u.iso, u.time))}</span>
        <span class="tm"><span class="team-badge" style="--c1:${u.ac};--c2:#fff">${esc(u.away.charAt(0))}</span>${esc(u.away)}</span>
      </div>`).join("");
    }
    return `<div class="stats-panel" id="statsPanel">
      <div class="panel-tabs">${tabs.map((t) => `<button class="panel-tab ${state.statsTab === t[0] ? "active" : ""}" data-action="stats-tab" data-tab="${t[0]}">${t[1]}</button>`).join("")}</div>
      <div class="panel-body">${body}</div>
    </div>`;
  }

  function liveWidgetHTML() {
    const l = D.live;
    return `<div class="live-widget" id="liveWidget">
      <div class="live-head"><span class="badge-live"><span class="live-dot"></span> مباشر</span><span>${esc(l.league)}</span></div>
      <div class="live-score-row">
        <div class="live-team">${badge(l.home)}<span>${esc(D.teams[l.home].name)}</span></div>
        <div class="live-big-score"><span>${l.hs}</span> - <span>${l.as}</span><div style="font-size:10px;color:#4ade80;font-weight:800" data-live-minute>${l.minute}</div></div>
        <div class="live-team">${badge(l.away)}<span>${esc(D.teams[l.away].name)}</span></div>
      </div>
      <div class="live-events">${l.events.map((e) => `<div class="live-event ${e.type}">
        <span class="min">${esc(e.min)}</span><span class="ico">${e.type === "goal" ? "⚽" : e.type === "yellow" ? "▮" : "↔"}</span>
        <span>${esc(e.text)}</span>
      </div>`).join("")}</div>
      <div class="live-actions">
        <button data-action="match-details" data-id="${esc(l.id || "")}">تفاصيل المباراة</button>
        <button data-action="rate-player">اختر رجل المباراة</button>
      </div>
    </div>`;
  }

  function mediaGridHTML(items) {
    return `<div class="media-grid">${items.map((m) => `<div class="media-card" data-action="video" data-title="${esc(m.title)}" data-image="${esc(m.image)}">
      ${img(m.image, m.title)}
      <span class="media-badge">${m.type === "video" ? "▶ " + esc(m.duration) : "📷 صورة"}</span>
      ${m.type === "video" ? `<span class="media-play">▶</span>` : ""}
      <span class="media-title">${esc(m.title)}</span>
    </div>`).join("")}</div>`;
  }

  function reelsGridHTML(items) {
    return `<div class="reels-grid">${items.map((r) => `<div class="reel-card" data-action="video" data-title="${esc(r.title)}" data-image="${esc(r.image)}">
      ${img(r.image, r.title)}
      <span class="reel-play">▶</span><span class="reel-views">▶ ${esc(r.views)}</span>
      <div class="reel-info"><h4>${esc(r.title)}</h4><span>${esc(r.date)} - ${esc(r.time)}</span></div>
    </div>`).join("")}</div>`;
  }

  /* ---------- مصادر رسمية / فيديو قانوني ---------- */
  function officialVideosHTML(limit) {
    const list = (window.KORA_OFFICIAL_VIDEOS || []).slice(0, limit || 6);
    if (!list.length) return "";
    return `<div class="official-grid">${list.map((v) => `<button class="official-card" data-action="official-video" data-id="${esc(v.id)}" data-title="${esc(v.title)}" data-source="${esc(v.source)}" data-source-url="${esc(v.sourceUrl)}" data-kind="${esc(v.kind)}">
      <span class="official-thumb"><img src="${esc(v.thumb)}" alt="${esc(v.title)}" loading="lazy" onerror="this.remove()"><span class="official-play">▶</span><span class="official-kind">${esc(v.kind)}</span></span>
      <span class="official-meta"><b>${esc(v.title)}</b><small>${esc(v.source)} · تضمين رسمي</small></span>
    </button>`).join("")}</div>`;
  }

  function sourcesHTML() {
    const list = window.KORA_SOURCES || [];
    return `<div class="sources-grid">${list.map((s) => `<article class="source-card card">
      <div class="source-card-head"><span class="source-tag">${esc(s.tag)}</span><h3>${esc(s.name)}</h3></div>
      <p>${esc(s.desc)}</p>
      <div class="source-links"><a class="source-link" href="${esc(s.url)}" target="_blank" rel="noopener">زيارة المصدر ↗</a>${s.extra ? `<a class="source-link" href="${esc(s.extraUrl)}" target="_blank" rel="noopener">${esc(s.extra)} ↗</a>` : ""}</div>
    </article>`).join("")}</div>`;
  }

  function renderSourcesPage() {
    view.innerHTML = `
      <div class="page-head"><div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <span>المصادر الرسمية</span></div>
        <h1>المصادر الرسمية والفيديو القانوني</h1>
        <p>مصادر تم التحقق منها توفر فيديو رسمياً أو بيانات برخصة مجانية. الموقع يضمّن فقط ما يسمح صاحبه بتضمينه، ولا يعيد بث مباريات محجوزة الحقوق.</p></div>
      <section class="section"><a class="source-link" href="#/broadcasters">📺 دليل الناقلين الرسميين — من يملك حقوق بث كل بطولة؟ ↗</a></section>
      <section class="section">${sectionHead("فيديوهات رسمية قابلة للتضمين")}
        ${officialVideosHTML(7)}
        <p class="modal-note" style="margin-top:12px">الفيديو يُعرض عبر مشغّل يوتيوب الرسمي (youtube-nocookie) من القناة صاحبة الحقوق. قد تظهر قيود جغرافية حسب سياسة يوتيوب أو الناشر.</p>
      </section>
      <section class="section">${sectionHead("دليل المصادر والتراخيص")}
        ${sourcesHTML()}
      </section>
      <section class="section"><div class="card" style="padding:20px;line-height:2;color:var(--ink-2)">
        <h3 style="margin-top:0">ملاحظة حقوقية</h3>
        <p>«مجاني» لا تعني دائماً «حرّ الحقوق». بعض القنوات الرسمية تسمح بالمشاهدة والتضمين عبر يوتيوب فقط، بينما ترخص ويكيميديا كومنز وOpen-Meteo إعادة الاستخدام مع ذكر المصدر. لا نستخدم أي رابط بث غير موثّق أو غير مصرّح بتضمينه.</p>
        <p>بيانات النتائج من ESPN، والشعارات والتشكيلات وقنوات البث من TheSportsDB (مفتاح مجاني 123)، والطقس من Open-Meteo برخصة CC BY 4.0.</p>
      </div></section>`;
  }

  /* ---------- دليل الناقلين الرسميين (حقوق البث) ---------- */
  function renderBroadcastersPage() {
    const list = window.KORA_BROADCASTERS || [];
    view.innerHTML = `
      <div class="page-head"><div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <span>الناقلون الرسميون</span></div>
        <h1>دليل الناقلين الرسميين وحقوق البث</h1>
        <p>من يملك حقوق بث كل بطولة في منطقتنا؟ ولماذا لا يوجد مصدر واحد لكل المباريات؟</p></div>
      <section class="section"><div class="card rights-note">
        <h3 style="margin-top:0">لماذا لا يوجد «مصدر واحد لكل المباريات»؟</h3>
        <p>لأن حقوق البث مقسّمة بين ناقلين مختلفين حسب <b>البطولة + الدولة + الموسم + باقة الاشتراك</b>: beIN وTOD، وSSC وثمانية، وأبوظبي الرياضية، والرياضية المغربية، وON Sport وغيرها. أي موقع يعدك ببث كل المباريات مجاناً من مصدر واحد هو غالباً موقع غير مرخّص يجمع روابط خارجية متغيرة — ونحن لا نتعامل مع هذه المواقع.</p>
        <p>yallaakora وسيط إخباري فقط: نرصد النتائج والأحداث والتغطية النصية، ونرشدك إلى <b>الناقل الرسمي صاحب الحق</b> للمشاهدة الكاملة. لا ننشر أي مادة مقرصنة، ولا نتحمل مسؤولية مواقع لا نملكها أو نديرها.</p>
      </div></section>
      <section class="section">${sectionHead("الناقلون الرسميون في المنطقة")}
        <div class="broadcasters-grid">${list.map((b) => `<article class="broadcaster-card card">
          <div class="broadcaster-head"><h3>${esc(b.name)}</h3><span class="source-tag">${esc(b.region)}</span></div>
          <ul class="broadcaster-comps">${b.comps.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
          <div class="source-links">${b.platforms.map((p) => `<a class="source-link" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.label)} ↗</a>`).join("")}</div>
          <p class="broadcaster-note">${esc(b.note)}</p>
        </article>`).join("")}</div>
      </section>
      <section class="section"><div class="card" style="padding:20px;line-height:2;color:var(--ink-2)">
        <h3 style="margin-top:0">كيف تتابع المباراة بشكل قانوني؟</h3>
        <p>1) افتح <a href="#/matches">صفحة المباريات</a> واختر مباراتك — ستجد القناة الناقلة الرسمية إن كانت متاحة في مصدر البيانات. 2) تابع <b>النقل المباشر النصي دقيقة بدقيقة</b> داخل مركز المباراة مجاناً. 3) للمشاهدة الكاملة، انتقل إلى منصة الناقل الرسمي المذكورة أعلاه عبر اشتراكه. 4) للملخصات والأهداف المجانية، زر <a href="#/sources">صفحة المصادر الرسمية</a>.</p>
        <p class="modal-note">هذا الدليل إرشادي وقد تتغير الحقوق حسب الموسم والاتفاقيات؛ المرجع النهائي هو إعلان الناقل نفسه.</p>
      </div></section>`;
  }

  /* ---------- الدوري المصري الممتاز (TheSportsDB) ---------- */
  const EGY_LEAGUE_ID = "4829";

  async function loadEgyptData() {
    const cached = store.get("egy_v1", null);
    if (cached && Date.now() - cached.at < 6 * 3600e3) return cached.data;
    const base = "https://www.thesportsdb.com/api/v1/json/123/";
    const [next, past, season] = await Promise.allSettled([
      tsdb(base + "eventsnextleague.php?id=" + EGY_LEAGUE_ID),
      tsdb(base + "eventspastleague.php?id=" + EGY_LEAGUE_ID),
      tsdb(base + "eventsseason.php?id=" + EGY_LEAGUE_ID + "&s=2026-2027")
    ]);
    const all = [];
    [next, past, season].forEach((r) => {
      if (r.status === "fulfilled" && r.value && r.value.events) all.push(...r.value.events);
    });
    const seen = new Set();
    const events = all.filter((e) => e && e.idEvent && !seen.has(e.idEvent) && seen.add(e.idEvent));
    const upcoming = events.filter((e) => e.intHomeScore == null || e.intHomeScore === "")
      .sort((a, b) => String(a.strTimestamp || a.dateEvent).localeCompare(String(b.strTimestamp || b.dateEvent)));
    const results = events.filter((e) => e.intHomeScore != null && e.intHomeScore !== "")
      .sort((a, b) => String(b.strTimestamp || b.dateEvent).localeCompare(String(a.strTimestamp || a.dateEvent)));
    const names = [...new Set(events.flatMap((e) => [e.strHomeTeam, e.strAwayTeam]).filter(Boolean))];
    let nameMap = {};
    try {
      if (window.KORA_LIVE && window.KORA_LIVE.translate && names.length) {
        const tr = await window.KORA_LIVE.translate(names);
        names.forEach((n, i) => { nameMap[n] = tr[i] || n; });
      }
    } catch (_) {}
    const data = { upcoming: upcoming.slice(0, 8), results: results.slice(0, 20), nameMap: nameMap };
    store.set("egy_v1", { at: Date.now(), data: data });
    return data;
  }

  function egyTeamName(data, raw) {
    return (data.nameMap && data.nameMap[raw]) || raw || "فريق";
  }

  function egyDate(e) {
    const d = new Date(e.strTimestamp || e.dateEvent);
    if (isNaN(d)) return e.dateEvent || "";
    const tz = getCity().tz;
    return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", timeZone: tz }) + " · " +
      d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  }

  function egyMatchCard(data, e, withScore) {
    const hn = egyTeamName(data, e.strHomeTeam), an = egyTeamName(data, e.strAwayTeam);
    return `<div class="egy-card card">
      <div class="egy-teams">
        <span class="egy-team">${e.strHomeTeamBadge ? `<img src="${esc(e.strHomeTeamBadge)}" alt="" loading="lazy" onerror="this.remove()">` : ""}<b>${esc(hn)}</b></span>
        <span class="egy-score">${withScore ? esc(e.intHomeScore) + " - " + esc(e.intAwayScore) : "VS"}</span>
        <span class="egy-team">${e.strAwayTeamBadge ? `<img src="${esc(e.strAwayTeamBadge)}" alt="" loading="lazy" onerror="this.remove()">` : ""}<b>${esc(an)}</b></span>
      </div>
      <div class="egy-meta"><span>${esc(egyDate(e))}</span>${e.intRound ? `<span>الجولة ${esc(e.intRound)}</span>` : ""}${e.strStatus ? `<span>${esc(e.strStatus === "FT" ? "انتهت" : e.strStatus)}</span>` : ""}</div>
    </div>`;
  }

  async function renderEgyptPage() {
    view.innerHTML = `
      <div class="page-head"><div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <span>الدوري المصري</span></div>
        <h1>الدوري المصري الممتاز</h1>
        <p>مواعيد ونتائج وجولات الدوري المصري — بيانات حية من TheSportsDB</p></div>
      <div id="egyBox"><p class="modal-note">جارٍ جلب بيانات الدوري المصري...</p></div>`;
    const box = document.getElementById("egyBox");
    try {
      const data = await loadEgyptData();
      if (!data.upcoming.length && !data.results.length) throw new Error("empty");
      box.innerHTML = `
        ${data.upcoming.length ? `<section class="section">${sectionHead("المباريات القادمة")}
          <div class="egy-grid">${data.upcoming.map((e) => egyMatchCard(data, e, false)).join("")}</div></section>` : ""}
        ${data.results.length ? `<section class="section">${sectionHead("أحدث النتائج")}
          <div class="egy-grid">${data.results.map((e) => egyMatchCard(data, e, true)).join("")}</div></section>` : ""}
        <section class="section"><div class="card" style="padding:18px;line-height:2;color:var(--ink-2)">
          <p style="margin:0">📺 الناقل المحلي الأبرز للدوري المصري هو <b>ON Sport</b> — <a href="#/broadcasters" data-action="goto-broadcasters">دليل الناقلين الرسميين</a>. البيانات من TheSportsDB (مفتاح مجاني 123) وقد تتأخر بعض الجولات عن التحديث.</p>
        </div></section>`;
    } catch (err) {
      console.warn("Egypt league unavailable:", err);
      box.innerHTML = `<div class="empty-state card"><span class="emoji">🇪🇬</span>تعذر جلب بيانات الدوري المصري حالياً. حاول التحديث لاحقاً.</div>`;
    }
  }

  async function fillEgyptHome() {
    const box = document.getElementById("egyHomeBox");
    if (!box) return;
    try {
      const data = await loadEgyptData();
      const next = data.upcoming[0];
      const last = data.results[0];
      const pick = next || last;
      if (!pick) { box.innerHTML = `<p class="modal-note">لا توجد مباريات متاحة حالياً.</p>`; return; }
      box.innerHTML = egyMatchCard(data, pick, !next) +
        `<a class="load-more" href="#/egypt" style="margin-top:10px">كل مباريات الدوري المصري ←</a>`;
    } catch (_) {
      box.innerHTML = `<p class="modal-note">تعذر جلب بيانات الدوري المصري حالياً.</p>`;
    }
  }

  /* ================= صفحات الميزات الجديدة ================= */

  /* --- الملخص اليومي التلقائي --- */
  function briefFacts() {
    const today = D.matches.today || [];
    const yesterday = D.matches.yesterday || [];
    const live = today.filter((m) => m.status === "live");
    const done = today.filter((m) => m.status === "finished");
    const goals = [];
    [...today, ...yesterday].forEach((m) => (m.details || []).forEach((d) => {
      if (/goal|penalty/i.test(String((d.type && d.type.text) || ""))) {
        goals.push({ name: (d.athlete && d.athlete.displayName) || "", min: (d.clock && d.clock.displayValue) || "", team: (D.teams[String((d.team || {}).id)] || {}).code || "" });
      }
    }));
    const scorer = (D.stats.scorers || [])[0];
    const facts = [
      "عدد مباريات اليوم: " + today.length + "، منها " + live.length + " مباشرة الآن و" + done.length + " انتهت.",
      "الأهداف المسجلة في التغطية الحية: " + goals.length + ".",
      goals.slice(0, 3).map((g) => (g.min ? g.min + " — " : "") + (g.name || "هدف") + (g.team ? " (" + g.team + ")" : "")).join(" · "),
      scorer ? "هداف الدوري: " + scorer.name + " (" + scorer.goals + " هدف)." : "",
      D.news[0] ? "الخبر الأبرز: " + D.news[0].title : ""
    ].filter(Boolean);
    return facts;
  }

  async function renderBriefPage() {
    const facts = briefFacts();
    view.innerHTML = `
      <div class="page-head"><div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <span>الملخص اليومي</span></div>
        <h1>الملخص اليومي 🤖</h1>
        <p>قراءة سريعة لكل ما حدث ويحدث اليوم، مولّدة تلقائياً من البيانات الحية</p></div>
      <section class="section"><div class="brief-card card">
        <div class="brief-head"><span>🤖 ملخص تلقائي</span><small>${esc(new Date().toLocaleString("ar-EG"))}</small></div>
        <ul class="brief-list">${facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        <div id="aiSummary"></div>
        <p class="modal-note">هذا الملخص مبني على بيانات ESPN/TheSportsDB ولا يتدخل محرر في صياغته. عند ربط واجهة AI من <code>js/config.js</code> يُضاف ملخص تحليلي تلقائياً.</p>
      </div></section>
      <section class="section">${sectionHead("أخبار اليوم", "#/news")}<div class="news-grid">${D.news.slice(0, 4).map(newsCard).join("")}</div></section>
      ${adSlotHTML()}`;
    const aiEndpoint = getAiEndpoint();
    if (aiEndpoint) {
      try {
        const r = await fetch(aiEndpoint, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: (CFG.ai || {}).model || "", input: facts.join("\n") })
        });
        const j = await r.json();
        const text = j.summary || j.text || (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);
        const box = document.getElementById("aiSummary");
        if (text && box) box.innerHTML = `<div class="ai-block"><b>تحليل إضافي:</b><p>${esc(text)}</p></div>`;
      } catch (_) {}
    }
  }

  function briefHomeHTML() {
    const facts = briefFacts().slice(0, 3);
    return `<div class="card brief-home">
      <div class="brief-head"><span>🤖 ملخص اليوم</span><a href="#/brief">التفاصيل ←</a></div>
      <ul>${facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
    </div>`;
  }

  /* --- مسابقة التوقعات --- */
  function settlePredictions() {
    const picks = store.get("predictions", {});
    const awarded = store.get("pred_awarded", []);
    let gained = 0;
    Object.keys(picks).forEach((id) => {
      const m = findMatch(id);
      if (!m || m.status !== "finished" || m.hs === "-" || m.as === "-" || awarded.includes(id)) return;
      const real = Number(m.hs) > Number(m.as) ? "H" : Number(m.hs) < Number(m.as) ? "A" : "D";
      if (picks[id] === real) { gained += 10; awarded.push(id); }
    });
    if (gained) { store.set("pred_awarded", awarded); store.set("points", getPoints() + gained); }
  }

  function predictionScore() {
    const picks = store.get("predictions", {});
    const awarded = store.get("pred_awarded", []);
    return { pts: awarded.length * 10, picks: Object.keys(picks).length };
  }

  function renderFantasyPage() {
    settlePredictions();
    const picks = store.get("predictions", {});
    const matches = (D.matches.today || []).slice(0, 6);
    const score = predictionScore();
    const board = store.get("fantasy_board", []);
    const me = store.get("fantasy_name", "أنت");
    const all = [...board.filter((b) => b.name !== me), { name: me, pts: score.pts }].sort((a, b) => b.pts - a.pts).slice(0, 6);
    view.innerHTML = `
      <div class="page-head"><div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <span>الفانتازي والتوقعات</span></div>
        <h1>مسابقة التوقعات 🎯</h1>
        <p>توقع نتيجة مباريات اليوم، اجمع النقاط، وتابع مستواك</p></div>
      <section class="section"><div class="card fantasy-bar">
        <div><span>نقاطك</span><b>${score.pts}</b></div>
        <div><span>توقعاتك</span><b>${score.picks}</b></div>
        <div><span>مستواك</span><b>${esc(levelInfo().badge + " " + levelInfo().name)}</b></div>
        <input id="fantasyName" maxlength="20" value="${esc(me)}" placeholder="اسمك في اللوحة" aria-label="اسمك" />
        <button data-action="fantasy-save">حفظ الاسم</button>
      </div></section>
      <section class="section">${sectionHead("توقع مباريات اليوم")}
        ${matches.length ? `<div class="predict-grid">${matches.map((m) => {
          const h = D.teams[m.home] || {}, a = D.teams[m.away] || {};
          const pick = picks[m.id];
          return `<div class="predict-card card">
            <div class="predict-top"><b>${esc(h.name || m.homeRaw)}</b><span>× ${esc(matchTime(m))}</span><b>${esc(a.name || m.awayRaw)}</b></div>
            <div class="predict-btns">
              ${[["H", "فوز " + (h.code || "1")], ["D", "تعادل"], ["A", "فوز " + (a.code || "2")]].map(([k, label]) =>
                `<button class="predict-btn ${pick === k ? "active" : ""}" data-action="predict" data-id="${esc(m.id)}" data-pick="${k}">${esc(label)}</button>`).join("")}
            </div>
            <small>${m.status === "finished" ? "النتيجة: " + esc(m.hs) + " - " + esc(m.as) : esc(m.league)}</small>
          </div>`;
        }).join("")}</div>` : `<div class="empty-state card"><span class="emoji">📅</span>لا توجد مباريات اليوم للتوقع عليها.</div>`}
      </section>
      <section class="section">${sectionHead("لوحة المتصدرين (على جهازك)")}
        <div class="card leaderboard">${all.map((b, i) => `<div class="leader-row"><span>${i + 1}</span><b>${esc(b.name)}</b><strong>${b.pts} نقطة</strong></div>`).join("")}</div>
        <p class="modal-note">اللوحة محلية على متصفحك فقط؛ لا يوجد خادم ألعاب. التوقع الصحيح = 10 نقاط.</p>
      </section>`;
  }

  /* --- الإعدادات والإشعارات --- */
  function renderSettingsPage() {
    const city = getCity();
    const perm = "Notification" in window ? Notification.permission : "unsupported";
    const on = notifyOn();
    let installBtn = "";
    if (window.__koraInstallPrompt) installBtn = `<button class="source-link" data-action="install-app">📲 تثبيت الموقع كتطبيق</button>`;
    view.innerHTML = `
      <div class="page-head"><div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <span>الإعدادات</span></div>
        <h1>الإعدادات والإشعارات 🔔</h1>
        <p>خصّص تجربتك: توقيت المباريات، الإشعارات، وتثبيت الموقع</p></div>
      <section class="section"><div class="settings-grid">
        <div class="card settings-card">
          <h3>📍 توقيت المباريات</h3>
          <p>كل أوقات المباريات تُعرض حسب مدينتك تلقائياً.</p>
          <select id="citySelect" data-action="city-change" aria-label="اختر مدينتك">
            ${CITIES.map((c) => `<option value="${esc(c.key)}" ${c.key === city.key ? "selected" : ""}>${esc(c.label)} (${esc(c.tz)})</option>`).join("")}
          </select>
        </div>
        <div class="card settings-card">
          <h3>🔔 إشعارات المباريات</h3>
          <p>حالة الإذن: <b>${esc(perm === "granted" ? "مسموح" : perm === "denied" ? "مرفوض" : "لم يُطلب بعد")}</b> · التفعيل: <b>${on ? "مفعّل" : "غير مفعّل"}</b></p>
          <p class="modal-note">تنبيه قبل بدء مباريات فرقك المتابَعة بـ ${esc((CFG.notifications || {}).minutesBefore || 15)} دقيقة، وأثناء فتح الموقع.</p>
          <p>إشعارات الخلفية (Cloudflare): <b>${esc(webpushStatusText())}</b>${getWorkerUrl() ? "" : " — أضف رابط الـ Worker من <code>#/admin</code>"}</p>
          ${getWorkerUrl() ? `<button class="source-link" data-action="webpush-toggle">${webpushState === "ready" ? "إلغاء اشتراك الإشعارات" : "تفعيل إشعارات الخلفية"}</button>` : ""}
          <p>FCM في الخلفية: <b>${esc(fcmStatusText())}</b>${fcmConfigured() ? "" : " — أضف بيانات Firebase في <code>js/config.js</code>"}</p>
          ${fcmToken ? `<p class="modal-note" dir="ltr" style="word-break:break-all;font-size:10px">${esc(fcmToken)}</p>` : ""}
          <div class="source-links">
            <button class="source-link" data-action="notify-toggle">${on ? "إيقاف الإشعارات" : "تفعيل الإشعارات"}</button>
            <button class="source-link" data-action="notify-test">إرسال إشعار تجريبي</button>
            ${fcmToken ? `<button class="source-link" data-action="fcm-copy">نسخ رمز الجهاز</button>` : ""}
            ${installBtn}
          </div>
        </div>
        <div class="card settings-card">
          <h3>⚽ مستواك</h3>
          <p>${esc(levelInfo().badge)} <b>${esc(levelInfo().name)}</b> — ${levelInfo().points} نقطة${levelInfo().next ? " · المتبقي للمستوى التالي: " + (levelInfo().next - levelInfo().points) : " · أعلى مستوى!"}</p>
          <a class="source-link" href="#/profile">عرض ملفي الكامل ↗</a>
        </div>
      </div></section>`;
  }

  /* --- الملف الشخصي --- */
  function renderProfilePage() {
    const lv = levelInfo();
    const favs = getFavs();
    const comments = getComments().filter((c) => c.key.startsWith("news_") || c.key.startsWith("match_"));
    const score = predictionScore();
    view.innerHTML = `
      <div class="page-head"><div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <span>ملفي</span></div>
        <h1>ملفي ونقاطي ⚽</h1><p>ملخص تفاعلك مع yallaakora — محفوظ على جهازك</p></div>
      <section class="section"><div class="profile-card card">
        <div class="profile-avatar">${esc(lv.badge)}</div>
        <div><h2>${esc(lv.name)}</h2><p>${lv.points} نقطة${lv.next ? " · " + (lv.next - lv.points) + " نقطة للمستوى التالي" : ""}</p></div>
      </div></section>
      <section class="section"><div class="profile-stats">
        <div class="card"><b>${esc(favs.length)}</b><span>فرق متابَعة</span></div>
        <div class="card"><b>${esc(comments.length)}</b><span>تعليقات</span></div>
        <div class="card"><b>${esc(score.picks)}</b><span>توقعات</span></div>
        <div class="card"><b>${esc(score.pts)}</b><span>نقاط توقعات</span></div>
      </div></section>
      <section class="section">${sectionHead(" كيف تجمع النقاط؟")}
        <div class="card" style="padding:20px;line-height:2;color:var(--ink-2)">
          <p>⭐ متابعة فريق: +2 · 💬 تعليق: +5 · 📊 تصويت في الاستطلاع: +5 · 🏆 اختيار رجل المباراة: +5 · 🎯 توقع صحيح: +10 · 📖 قراءة خبر: +1</p>
          <a class="source-link" href="#/fantasy">العب مسابقة التوقعات ↗</a>
        </div></section>`;
  }

  /* --- لوحة تحكم خفيفة (محلية بالكامل) --- */
  function renderAdminPage() {
    const a = CFG.ads || {};
    const sponsors = store.get("sponsors", []) || [];
    const keys = Object.keys(localStorage).filter((k) => k.indexOf("kora_") === 0).sort();
    const status = (ok) => ok ? `<span class="pill-ok">مفعّل</span>` : `<span class="pill-off">غير مفعّل</span>`;
    const cfg = [
      ["بيانات حية (ESPN)", status(!!D.liveMode)],
      ["إشعارات المتصفح", status(notifyOn())],
      ["Cloudflare Worker", status(!!getWorkerUrl())],
      ["Web Push", status(webpushState === "ready")],
      ["Firebase / FCM", fcmConfigured() ? status(fcmState === "ready") : `<span class="pill-off">بانتظار البيانات</span>`],
      ["واجهة AI", status(!!((CFG.ai || {}).endpoint))],
      ["AdSense", status(!!(a.enabled && a.adsenseClient))],
      ["PWA / Service Worker", status("serviceWorker" in navigator)]
    ];
    view.innerHTML = `
      <div class="page-head"><div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <span>لوحة التحكم</span></div>
        <h1>لوحة التحكم ⚙️</h1><p>نظرة سريعة على حالة الموقع والإعدادات — كل شيء محفوظ على جهازك فقط</p></div>
      <section class="section"><div class="admin-grid">
        <div class="card admin-card"><h3>حالة المصادر والميزات</h3>
          <div class="admin-rows">${cfg.map(([k, v]) => `<div><span>${esc(k)}</span>${v}</div>`).join("")}</div>
        </div>
        <div class="card admin-card"><h3>إحصائيات المحتوى</h3>
          <div class="admin-rows">
            <div><span>مباريات اليوم</span><b>${(D.matches.today || []).length}</b></div>
            <div><span>الأخبار</span><b>${D.news.length}</b></div>
            <div><span>الدوريات</span><b>${Object.keys(D.leagues || {}).length}</b></div>
            <div><span>مفاتيح التخزين المحلي</span><b>${keys.length}</b></div>
            <div><span>الرعاة المحليون</span><b>${sponsors.length}</b></div>
          </div>
        </div>
      </div></section>
      <section class="section"><div class="card admin-card">
        <h3>🗂️ البيانات المحفوظة على الجهاز</h3>
        ${keys.length ? `<div class="cache-list">${keys.map((k) => `<div><code>${esc(k)}</code><small>${(localStorage.getItem(k) || "").length} حرف</small><button data-action="cache-clear" data-key="${esc(k)}">حذف</button></div>`).join("")}</div>`
          : `<p class="modal-note">لا توجد بيانات محفوظة بعد.</p>`}
        <div class="source-links" style="margin-top:12px">
          <button class="source-link" data-action="cache-clear-all">مسح كل الكاش المحلي</button>
          <button class="source-link" data-action="admin-export">تصدير الإعدادات JSON</button>
        </div>
      </div></section>
      <section class="section"><div class="card admin-card">
        <h3>🔌 الربط بالـ Backend والإعلانات</h3>
        <p class="modal-note">تُحفظ هذه الروابط على جهازك فقط. <b>لا تكتب مفاتيح سرية هنا</b> — الروابط ومعرّف المعلن بيانات عامة.</p>
        <div class="admin-form admin-form-2">
          <input id="cfgWorkerUrl" dir="ltr" placeholder="https://yallakora-push.<account>.workers.dev" value="${esc(getWorkerUrl())}" />
          <input id="cfgVapidPublic" dir="ltr" placeholder="VAPID public key" value="${esc(getVapidKey())}" />
          <input id="cfgFunctionsUrl" dir="ltr" placeholder="https://europe-west1-PROJECT.cloudfunctions.net" value="${esc(getFunctionsUrl())}" />
          <input id="cfgAiEndpoint" dir="ltr" placeholder="https://.../aiBrief" value="${esc(getAiEndpoint())}" />
          <input id="cfgAdsClient" dir="ltr" placeholder="ca-pub-XXXXXXXXXXXXXXXX" value="${esc(adCfg().adsenseClient)}" />
          <input id="cfgAdsSlot" dir="ltr" placeholder="معرف مساحة الإعلان" value="${esc(adCfg().adsenseSlot)}" />
        </div>
        <label class="admin-check"><input type="checkbox" id="cfgAdsEnabled" ${adCfg().enabled ? "checked" : ""} /> تفعيل مساحات AdSense</label>
        <div class="source-links" style="margin-top:10px"><button class="source-link" data-action="admin-save-config">حفظ الإعدادات وإعادة التحميل</button></div>
      </div></section>
      <section class="section"><div class="card admin-card">
        <h3>🤝 شركاء الموقع (يظهرون في مساحات الإعلان)</h3>
        <p class="modal-note">أضف راعياً من رابطه الرسمي فقط. تظهر هذه القائمة على جهازك، ويمكنك إعدادها مركزياً في <code>js/config.js</code> تحت <code>ads.sponsors</code>.</p>
        <div class="admin-form">
          <input id="sponsorName" placeholder="اسم الشريك" maxlength="40" />
          <input id="sponsorUrl" placeholder="https://..." dir="ltr" />
          <input id="sponsorLogo" placeholder="رابط الشعار (اختياري)" dir="ltr" />
          <button data-action="sponsor-add">إضافة</button>
        </div>
        ${sponsors.length ? `<div class="cache-list" style="margin-top:12px">${sponsors.map((s, i) => `<div><b>${esc(s.name)}</b><small>${esc(s.url)}</small><button data-action="sponsor-remove" data-index="${i}">حذف</button></div>`).join("")}</div>` : ""}
      </div></section>
      <p class="modal-note">هذه لوحة عرض وإدارة محلية، وليست لوحة تحكم خادم. النشر المركزي وتحليلات الزوار تحتاج استضافة TypeScript/backend أو خدمة تحليلات خارجية.</p>`;
  }

  /* ---------- views ---------- */
  function renderHome() {
    const latest = D.news.slice(0, 8);
    view.innerHTML = `
      <section class="section">${stripHTML(state.homeMatchDay, "homeStrip")}</section>
      <div class="brief-slot">${briefHomeHTML()}</div>
      ${featuredHTML()}
      <section class="section">
        <div class="two-col">
          <div>
            <div class="poll-card" style="margin-bottom:20px">
              <div class="video-spot" data-action="video" data-title="${esc(D.news[12].title)}" data-image="${esc(D.news[12].image)}" style="min-height:210px">
                ${img(D.news[12].image, D.news[12].title)}<span class="play-circle">▶</span>
                <div class="video-spot-caption">${esc(D.news[12].title)}</div>
              </div>
            </div>
            ${sectionHead("الأخبار", "#/news")}
            <div class="news-grid">${latest.map(newsCard).join("")}</div>
            <a class="load-more" href="#/news">عرض كل الأخبار</a>
          </div>
          <aside>
            ${pollHTML()}
            <div style="height:20px"></div>
            ${liveWidgetHTML()}
            <div style="height:20px"></div>
            <div class="ask-card">
              <h4>من تختار رجل المباراة؟</h4>
              <p>شاركنا رأيك في مباراة الأهلي وبيراميدز</p>
              <button data-action="rate-player">اختر الآن</button>
            </div>
          </aside>
        </div>
      </section>
      <section class="section">
        ${sectionHead("ريلز yallaakora", "#/reels")}
        ${reelsGridHTML(D.reels.slice(0, 4))}
      </section>
      <section class="section">
        <div class="two-col">
          <div>
            ${sectionHead("إحصائيات الدوري الإنجليزي", "#/stats")}
            ${statsHTML()}
          </div>
          <div>
            ${sectionHead("المباريات القادمة", "#/matches")}
            <div class="stats-panel">
              ${D.stats.upcoming.map((u) => `<div class="upcoming-row">
                <span class="tm"><span class="team-badge" style="--c1:${u.hc};--c2:#fff">${esc(u.home.charAt(0))}</span>${esc(u.home)}</span>
                <span class="when">${esc(cityTime(u.iso, u.time))}</span>
                <span class="tm"><span class="team-badge" style="--c1:${u.ac};--c2:#fff">${esc(u.away.charAt(0))}</span>${esc(u.away)}</span>
              </div>`).join("")}
            </div>
          </div>
        </div>
      </section>
      <section class="section">
        ${sectionHead("الدوري المصري الممتاز", "#/egypt", "كل المباريات")}
        <div id="egyHomeBox"><p class="modal-note">جارٍ جلب بيانات الدوري المصري...</p></div>
      </section>
      <section class="section">
        ${sectionHead("فيديو رسمي مجاني", "#/sources", "كل المصادر")}
        ${officialVideosHTML(4)}
      </section>
      <section class="section">
        ${sectionHead("صور وفيديوهات", "#/media")}
        ${mediaGridHTML(D.media.slice(0, 10))}
      </section>
      <section class="section">
        ${sectionHead("كلام في الكورة", "#/news")}
        <div class="news-grid">${D.news.slice(8, 16).map(newsCard).join("")}</div>
        ${adSlotHTML("home")}
      </section>`;
  }

  function renderNewsPage(query) {
    const cats = ["الكل", ...new Set(D.news.map((n) => n.category))];
    const cat = query.get("cat") || state.newsFilter;
    state.newsFilter = cats.includes(cat) ? cat : "الكل";
    const filtered = state.newsFilter === "الكل" ? D.news : D.news.filter((n) => n.category === state.newsFilter);
    const shown = filtered.slice(0, state.newsShown);
    view.innerHTML = `
      <div class="page-head">
        <div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <span>الأخبار</span></div>
        <h1>الأخبار الرياضية</h1>
        <p>كل المستجدات والنتائج والتحليلات من عالم الكرة</p>
      </div>
      <div class="filter-bar">${cats.map((c) => `<button class="filter-btn ${c === state.newsFilter ? "active" : ""}" data-action="news-filter" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="two-col">
        <div>
          <div class="news-list">${shown.map(newsRow).join("") || `<div class="empty-state card"><span class="emoji">📭</span>لا توجد أخبار في هذا القسم</div>`}</div>
          ${shown.length < filtered.length ? `<button class="load-more" data-action="load-more">المزيد من الأخبار</button>` : ""}
        </div>
        <aside>
          ${sectionHead("الأكثر مشاهدة")}
          <div class="card" style="padding:8px">${D.news.slice(0, 6).map((n, i) => `<div class="news-row" data-action="article" data-id="${n.id}" style="grid-template-columns:22px 1fr;gap:8px;padding:8px;border:0">
            <span class="rank-num">${i + 1}</span><div><h4 style="font-size:12px;font-weight:800;line-height:1.5">${esc(n.title)}</h4><span class="time-meta">${esc(n.time)}</span></div>
          </div>`).join("")}</div>
          <div style="height:20px"></div>
          ${pollHTML()}
        </aside>
      </div>`;
  }

  function renderArticle(id) {
    const n = D.news.find((x) => x.id === id) || D.news[0];
    const reads = store.get("reads", {});
    const todayKey = new Date().toDateString();
    if (reads[n.id] !== todayKey) {
      reads[n.id] = todayKey;
      store.set("reads", reads);
      store.set("points", getPoints() + 1);
    }
    setSEO({
      title: n.title, desc: n.excerpt || n.body[0], image: n.image, type: "article",
      schema: {
        "@context": "https://schema.org", "@type": "NewsArticle",
        "headline": n.title, "description": n.excerpt || n.body[0],
        "image": n.image ? [n.image] : [], "datePublished": n.date || "",
        "articleSection": n.category, "inLanguage": "ar",
        "publisher": { "@type": "Organization", "name": "yallaakora" },
        "mainEntityOfPage": location.href
      }
    });
    const related = D.news.filter((x) => x.category === n.category && x.id !== n.id).slice(0, 4);
    const share = [
      ["f", "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(location.href)],
      ["𝕏", "https://twitter.com/intent/tweet?text=" + encodeURIComponent(n.title) + "&url=" + encodeURIComponent(location.href)],
      ["●", "https://api.whatsapp.com/send?text=" + encodeURIComponent(n.title + " " + location.href)]
    ];
    view.innerHTML = `
      <div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <a href="#/news">الأخبار</a> ‹ <span>${esc(n.category)}</span></div>
      <article class="article-view">
        <div class="article-hero">${img(n.image, n.title)}
          <div class="article-hero-inner"><span class="chip dark">${esc(n.category)}</span><h1>${esc(n.title)}</h1>
          <span class="time-meta" style="color:#cbd5e1">${esc(n.date)} - ${esc(n.time)}</span></div>
        </div>
        <div class="article-content">
          <div class="article-meta"><span>✍️ فريق التحرير</span><span>📅 ${esc(n.date)}</span><span>🕒 ${esc(n.time)}</span><span>👁 ${num(n.views)} مشاهدة</span></div>
          ${n.body.map((p) => `<p>${esc(p)}</p>`).join("")}
          ${n.link ? `<a class="source-link" href="${esc(n.link)}" target="_blank" rel="noopener">اقرأ المقال الأصلي في المصدر ↗</a>` : ""}
          <div class="article-share"><span>مشاركة:</span>${share.map((s) => `<a href="${s[1]}" target="_blank" rel="noopener">${s[0]}</a>`).join("")}</div>
          <section class="article-comments"><h3>آراء القرّاء</h3>${commentsHTML("news_" + n.id)}</section>
          ${adSlotHTML("article")}
        </div>
      </article>
      ${related.length ? `<section class="section related-box">${sectionHead("أخبار ذات صلة", "#/news")}<div class="news-grid">${related.map(newsCard).join("")}</div></section>` : ""}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderMatchesPage() {
    const days = [["yesterday", "مباريات الأمس"], ["today", "مباريات اليوم"], ["tomorrow", "مباريات الغد"]];
    const favs = getFavs();
    const keep = (m) => !state.showFavorites || favs.includes(String(m.home)) || favs.includes(String(m.away));
    const empty = `<div class="empty-state card"><span class="emoji">⭐</span>لم تتابع أي فريق بعد. افتح مباراة واضغط «متابعة» بجانب الفريق.</div>`;
    view.innerHTML = `
      <div class="page-head">
        <div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <span>المباريات</span></div>
        <h1>مركز المباريات</h1><p>نتائج ومواعيد كل المباريات في مختلف الدوريات</p>
        <div class="filter-bar"><button class="filter-btn ${state.showFavorites ? "active" : ""}" data-action="fav-filter">⭐ متابعتي ${favs.length ? "(" + favs.length + ")" : ""}</button></div>
      </div>
      <div class="matches-page-grid">
        <div>${days.map(([d, t]) => {
          const list = D.matches[d].filter(keep);
          if (state.showFavorites && !list.length) return "";
          return `<div class="day-group"><h3>${t}</h3><div class="strip-scroll">${list.map(matchCard).join("")}</div></div>`;
        }).join("") || (state.showFavorites ? empty : "")}</div>
        <aside>${liveWidgetHTML()}<div style="height:20px"></div>${pollHTML()}</aside>
      </div>`;
  }

  function renderLeagues(query) {
    const leagues = (D.leagues || []).map((l) => [l.name, l.icon, l.count || "تابع المباريات"]);
    const filter = query.get("league");
    view.innerHTML = `
      <div class="page-head"><div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <span>دوريات وبطولات</span></div>
        <h1>دوريات وبطولات</h1><p>تابع ترتيب ونتائج كل البطولات</p></div>
      ${filter ? `<div class="filter-bar"><button class="filter-btn active">${esc(filter)}</button><a class="filter-btn" href="#/leagues">عرض الكل</a></div>` : ""}
      <div class="league-grid">${leagues.map((l) => `<div class="card league-card" data-action="league" data-name="${esc(l[0])}">
        <span class="league-icon">${l[1]}</span><div><h4>${esc(l[0])}</h4><small>${l[2]}</small></div>
      </div>`).join("")}</div>
      <section class="section" style="margin-top:26px">${sectionHead("إحصائيات الدوري الإنجليزي")}${statsHTML()}</section>`;
  }

  function renderSearchPage(query) {
    const q = query.get("q") || "";
    const term = q.toLowerCase();
    const res = D.news.filter((n) => (n.title + n.category + n.excerpt).toLowerCase().includes(term));
    view.innerHTML = `
      <div class="page-head"><div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <span>البحث</span></div>
        <h1>نتائج البحث عن «${esc(q)}»</h1><p>تم العثور على ${res.length} نتيجة</p></div>
      <div class="news-list">${res.map(newsRow).join("") || `<div class="empty-state card"><span class="emoji">🔍</span>لم نجد نتائج مطابقة</div>`}</div>`;
  }

  function renderSimplePage(key) {
    const pages = {
      media: ["المالتيميديا", "صور وفيديوهات من عالم الرياضة", () => mediaGridHTML(D.media)],
      reels: ["ريلز yallaakora", "أبرز اللحظات في مقاطع قصيرة", () => reelsGridHTML(D.reels)],
      transfers: ["سوق الانتقالات", "آخر الصفقات والشائعات", () => `<div class="news-list">${D.news.filter((n) => n.category === "الانتقالات" || n.id === "n3" || n.id === "n14").map(newsRow).join("")}</div>`],
      stats: ["الإحصائيات", "أرقام وترتيبات الدوريات", () => statsHTML()],
      fantasy: ["فانتازي", "دليلك للجولة القادمة", () => `<div class="news-list">${D.news.filter((n) => n.category === "فانتازي").map(newsRow).join("")}</div>`],
      about: ["من نحن", "منصة عربية للإعلام الرياضي", () => `<div class="card" style="padding:24px;line-height:2;color:var(--ink-2)"><p>yallaakora منصة رياضية عربية تهدف إلى تقديم أخبار كرة القدم والرياضات الأخرى بصورة سريعة وموثوقة، مع تغطية المباريات والنتائج المباشرة والتحليلات.</p><p>«النقل المباشر» في yallaakora هو تغطية نصية لحظية دقيقة بدقيقة — أحداث وأهداف وإحصائيات ومواعيد وأخبار — وليس بالضرورة بثاً مرئياً كاملاً للمباراة. حقوق البث المرئي الكاملة ملك للناقلين الرسميين، ونرشدك إليهم عبر <a href="#/broadcasters">دليل الناقلين الرسميين</a>.</p><p>نسعى إلى توفير تجربة استخدام سهلة على كل الأجهزة، مع محتوى متجدد على مدار اليوم.</p></div>`],
      contact: ["اتصل بنا", "نسمع رأيك دائماً", () => `<div class="card" style="padding:24px"><p>للتواصل مع فريق التحرير: <b>hello@koralive.example</b></p><p>للإعلانات والشراكات: <b>ads@koralive.example</b></p></div>`],
      policy: ["سياسة الخصوصية والمحتوى", "كيف نستخدم بياناتك ونحمي الحقوق", () => `<div class="card" style="padding:24px;line-height:2;color:var(--ink-2)"><h3 style="margin-top:0">خصوصيتك</h3><p>نحن نحترم خصوصيتك. البيانات التي تدخلها مثل بريدك الإلكتروني تُحفظ محلياً على جهازك لأغراض الاشتراك في الإشعارات فقط، ولا يتم مشاركتها مع أي طرف ثالث.</p><h3>سياسة المحتوى وحقوق النشر</h3><p>لا يتم نشر أي محتوى إلا بعد التأكد من مصدره القانوني، ونرفض نشر أي مواد مقرصنة. الفيديوهات المضمّنة في الموقع تأتي من قنوات رسمية صاحبة الحقوق عبر مشغّل يوتيوب الرسمي فقط، دون تنزيل أو إعادة بث.</p><p>حقوق البث المرئي الكاملة للمباريات مملوكة للناقلين الرسميين (beIN وTOD، SSC وثمانية، أبوظبي الرياضية، الرياضية المغربية، ON Sport وغيرهم) بحسب البطولة والدولة والموسم. yallaakora وسيط إخباري يرشدك إلى الناقل الرسمي ولا يبث مباريات محجوزة الحقوق.</p><p>الموقع غير مسؤول عن أي مواقع أو روابط خارجية لا يملكها أو يديرها، بما فيها المواقع التي تنتحل أسماء مشابهة وتجمع روابط بث غير مرخّصة.</p><p>بيانات النتائج والأحداث من ESPN، والشعارات والتشكيلات من TheSportsDB، وبيانات الطقس من Open-Meteo برخصة CC BY 4.0 مع ذكر المصدر.</p></div>`],
      advertise: ["للإعلان معنا", "مساحتك أمام جمهور رياضي واسع", () => `<div class="card" style="padding:24px;line-height:2"><p>تواصل مع فريق الإعلانات عبر <b>ads@koralive.example</b> لمعرفة الباقات المتاحة.</p></div>`],
      app: ["تطبيق yallaakora", "كل الكرة في جيبك", () => `<div class="card" style="padding:30px;text-align:center"><div style="font-size:50px">⚽</div><h3 style="margin-block:10px">حمل التطبيق الآن</h3><p style="color:var(--muted)">تابع النتائج المباشرة والإشعارات أينما كنت.</p></div>`]
    };
    const p = pages[key] || pages.about;
    view.innerHTML = `<div class="page-head"><div class="breadcrumb"><a href="#/">الرئيسية</a> ‹ <span>${esc(p[0])}</span></div>
      <h1>${esc(p[0])}</h1><p>${esc(p[1])}</p></div>${p[2]()}`;
  }

  /* ---------- modal ---------- */
  function openModal(html, title) {
    modalRoot.innerHTML = `<div class="modal"><div class="modal-head"><h3 id="modalTitle">${esc(title || "التفاصيل")}</h3><button data-action="modal-close" aria-label="إغلاق">✕</button></div><div class="modal-body">${html}</div></div>`;
    modalRoot.classList.add("open");
    modalRoot.setAttribute("aria-hidden", "false");
    initStreamPlayer();
  }
  function closeModal() {
    modalRoot.classList.remove("open");
    modalRoot.setAttribute("aria-hidden", "true");
  }
  modalRoot.addEventListener("click", (e) => { if (e.target === modalRoot) closeModal(); });

  function findMatch(id) {
    for (const d of Object.keys(D.matches)) {
      const m = D.matches[d].find((x) => x.id === id);
      if (m) return m;
    }
    return null;
  }

  function matchExtras(m) {
    const bits = [];
    if (m.weather) {
      bits.push(`<div class="match-extra"><span class="ex-ico">🌡️</span><div class="ex-txt"><b>طقس المباراة</b><span>${esc(m.weather.temp)}° · ${esc(m.weather.desc)} · <a href="https://open-meteo.com/" target="_blank" rel="noopener" title="بيانات الطقس برخصة CC BY 4.0">Open-Meteo</a></span></div></div>`);
    }
    if (m.tv) {
      bits.push(`<div class="match-extra">${m.tv.logo ? `<img class="ex-logo" src="${esc(m.tv.logo)}" alt="" loading="lazy" onerror="this.remove()">` : `<span class="ex-ico">📺</span>`}<div class="ex-txt"><b>قناة البث الرسمية</b><span>${esc(m.tv.channel || "قناة رسمية")}${m.tv.country ? " · " + esc(m.tv.country) : ""}</span></div></div>`);
    }
    return bits.length ? `<div class="match-extras">${bits.join("")}</div>` : "";
  }

  const POS = (s) => {
    const v = String(s || "");
    if (/goal|keeper/i.test(v)) return "حارس";
    if (/sub/i.test(v)) return "بديل";
    if (/back|defen/i.test(v)) return "مدافع";
    if (/mid|centre|center/i.test(v)) return "خط وسط";
    if (/forward|wing|attack|striker/i.test(v)) return "مهاجم";
    return v;
  };

  async function tsdb(url) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return await r.json();
      } catch (e) {
        if (attempt === 1) throw e;
        await new Promise((res) => setTimeout(res, 400));
      }
    }
  }

  async function findLineupEvent(m) {
    const ht = D.teams[m.home] || {}, at = D.teams[m.away] || {};
    const h = String(m.homeRaw || ht.rawName || ht.name || "");
    const a = String(m.awayRaw || at.rawName || at.name || "");
    const queries = [h + " vs " + a, a + " vs " + h, h, a].filter((q) => q.trim());
    for (const q of queries) {
      try {
        const j = await tsdb("https://www.thesportsdb.com/api/v1/json/123/searchevents.php?e=" + encodeURIComponent(q));
        const ev = (j.event || [])[0];
        if (ev && ev.idEvent) return ev;
      } catch (_) {}
    }
    return null;
  }

  function lineupHTML(m, rows) {
    const side = (title, list) => {
      const xi = list.filter((r) => String(r.strSubstitute).toLowerCase() !== "yes");
      const subs = list.filter((r) => String(r.strSubstitute).toLowerCase() === "yes");
      const one = (r) => `<div class="lineup-player">
        ${r.strCutout || r.strThumb ? `<img src="${esc(r.strCutout || r.strThumb)}" alt="" loading="lazy" onerror="this.remove()">` : `<span class="lineup-num">${esc(r.intSquadNumber || "—")}</span>`}
        <div><b>${esc(r.strPlayer || "لاعب")}</b><small>${esc(POS(r.strPosition))}${r.intSquadNumber ? " · #" + esc(r.intSquadNumber) : ""}</small></div>
      </div>`;
      return `<div class="lineup-side"><h4>${esc(title)}</h4>
        <div class="lineup-label">التشكيل الأساسي</div>${xi.map(one).join("") || `<p class="modal-note">غير متوفر</p>`}
        <div class="lineup-label">البدلاء</div>${subs.map(one).join("") || `<p class="modal-note">غير متوفر</p>`}
      </div>`;
    };
    return `<div class="lineup-grid">
      ${side((D.teams[m.home] || {}).name || m.homeRaw || "الفريق الأول", rows.filter((r) => String(r.strHome).toLowerCase() === "yes"))}
      ${side((D.teams[m.away] || {}).name || m.awayRaw || "الفريق الثاني", rows.filter((r) => String(r.strHome).toLowerCase() !== "yes"))}
    </div>`;
  }

  async function loadLineup(box, m) {
    const key = "lineup_rows_" + m.id;
    const cached = store.get(key, null);
    if (cached && cached.length) { box.innerHTML = lineupHTML(m, cached); return; }
    box.innerHTML = `<p class="modal-note">جارٍ جلب التشكيلات...</p>`;
    try {
      const ev = await findLineupEvent(m);
      if (!ev) throw new Error("no-event");
      const data = await tsdb("https://www.thesportsdb.com/api/v1/json/123/lookuplineup.php?id=" + encodeURIComponent(ev.idEvent));
      const rows = data.lineup || [];
      if (!rows.length) throw new Error("empty");
      store.set(key, rows);
      box.innerHTML = lineupHTML(m, rows);
    } catch (err) {
      console.warn("Lineup unavailable:", m.id, err);
      box.innerHTML = `<p class="modal-note">التشكيلات غير متوفرة لهذه المباراة في مصدر البيانات حالياً.</p>`;
    }
  }

  /* ---------- النقل المباشر النصي: دقيقة بدقيقة ---------- */
  function commentaryIcon(t) {
    if (/goal|penalty/i.test(t)) return "⚽";
    if (/red/i.test(t)) return "🟥";
    if (/yellow/i.test(t)) return "🟨";
    if (/sub/i.test(t)) return "↔";
    if (/corner/i.test(t)) return "🚩";
    if (/foul/i.test(t)) return "⚠️";
    if (/offside/i.test(t)) return "🚫";
    if (/save/i.test(t)) return "🧤";
    return "•";
  }

  function commentaryHTML(m, data) {
    const head = `<div class="cm-head">
      <span class="cm-live ${m.status === "live" ? "on" : ""}">${m.status === "live" ? "🔴 تغطية حية" : "📝 تغطية نصية"}</span>
      <span class="cm-src">دقيقة بدقيقة · المصدر: ESPN</span>
      ${m.status === "live" ? `<button class="cm-refresh" data-action="commentary-refresh" data-id="${esc(m.id)}">⟳ تحديث</button>` : ""}
    </div>`;
    const tv = data.broadcasts && data.broadcasts.length
      ? `<p class="modal-note">الناقلون المرصودين في مصدر البيانات: ${data.broadcasts.map(esc).join(" · ")} — <a href="#/broadcasters" data-action="goto-broadcasters">دليل الناقلين الرسميين</a></p>`
      : "";
    if (!data.items.length) {
      return head + tv + `<p class="modal-note">التغطية النصية غير متاحة لهذه المباراة حالياً في مصدر البيانات. يمكنك متابعة تبويب «أحداث المباراة» للأهداف والبطاقات.</p>`;
    }
    const rows = data.items.map((x) => `<div class="cm-row ${/goal|penalty/i.test(x.type) ? "is-goal" : ""}">
      <span class="cm-min">${esc(x.min || (x.period ? "ش" + x.period : "—"))}</span>
      <span class="cm-ico">${commentaryIcon(x.type)}</span>
      <p class="cm-text">${esc(x.text)}</p>
    </div>`).join("");
    return head + tv + `<div class="cm-list">${rows}</div>
      <p class="modal-note">أحدث ${data.items.length} تعليقاً · التغطية النصية بديل قانوني عن البث المرئي، وحقوق الفيديو الكاملة للناقل الرسمي.</p>`;
  }

  async function loadCommentary(box, m, force) {
    const key = "commentary_" + m.id;
    const cached = store.get(key, null);
    const ttl = m.status === "live" ? 60e3 : 12 * 3600e3;
    if (!force && cached && Date.now() - cached.at < ttl) {
      box.innerHTML = commentaryHTML(m, cached.data);
      return;
    }
    box.innerHTML = `<p class="modal-note">جارٍ جلب التغطية النصية دقيقة بدقيقة...</p>`;
    const eventId = String(m.id).split("-")[2] || "";
    try {
      if (!window.KORA_LIVE || !window.KORA_LIVE.commentary || !m.leagueKey || !eventId) throw new Error("no-source");
      const data = await window.KORA_LIVE.commentary(m.leagueKey, eventId);
      store.set(key, { at: Date.now(), data: data });
      box.innerHTML = commentaryHTML(m, data);
    } catch (err) {
      console.warn("Commentary unavailable:", m.id, err);
      if (cached && cached.data) {
        box.innerHTML = commentaryHTML(m, cached.data) + `<p class="modal-note">تعذر التحديث الآن — يتم عرض آخر نسخة محفوظة.</p>`;
      } else {
        box.innerHTML = `<p class="modal-note">التغطية النصية غير متوفرة لهذه المباراة حالياً. تابع تبويب «أحداث المباراة» أو عد لاحقاً.</p>`;
      }
    }
  }

  function matchCenter(m, h, a) {
    const events = (m.details || []).slice().reverse();
    const typeOf = (d) => String((d.type && d.type.text) || "");
    const labelOf = (s) => /penalty/i.test(s) ? "ركلة جزاء" : /goal/i.test(s) ? "هدف" : /red/i.test(s) ? "بطاقة حمراء" : /yellow|card/i.test(s) ? "بطاقة صفراء" : /substitution|sub/i.test(s) ? "تبديل" : "حدث";
    const iconOf = (s) => /goal|penalty/i.test(s) ? "⚽" : /red/i.test(s) ? "🟥" : /yellow|card/i.test(s) ? "🟨" : "↔";
    const ofSide = (id) => events.filter((d) => String((d.team || {}).id || "") === String(id));
    const count = (id, re) => ofSide(id).filter((d) => re.test(typeOf(d))).length;
    const rows = [
      ["الأهداف", /goal|penalty/i, "⚽"],
      ["بطاقات صفراء", /yellow/i, "🟨"],
      ["بطاقات حمراء", /red/i, "🟥"],
      ["تبديلات", /substitution|sub/i, "↔"]
    ];

    const summary = `
      <div style="font-size:12px;line-height:2;color:var(--ink-2)">
        <p>الموعد: ${esc(matchTime(m))} · ${esc(getCity().label)}</p>
        <p>الحالة: ${m.status === "live" ? "مباشر الآن" : m.status === "finished" ? "انتهت المباراة" : "لم تبدأ بعد"}</p>
        <p>البطولة: ${esc(m.league)}</p>
      </div>
      ${matchExtras(m)}
      <div class="follow-row">
        <button class="follow-btn ${isFav(m.home) ? "active" : ""}" data-action="follow-team" data-id="${esc(m.home)}" data-name="${esc(h.name)}">${isFav(m.home) ? "⭐ متابَع" : "☆ متابعة"} ${esc(h.code)}</button>
        <button class="follow-btn ${isFav(m.away) ? "active" : ""}" data-action="follow-team" data-id="${esc(m.away)}" data-name="${esc(a.name)}">${isFav(m.away) ? "⭐ متابَع" : "☆ متابعة"} ${esc(a.code)}</button>
      </div>
      <button class="vote-btn" data-action="rate-player" style="margin-top:14px">اختر رجل المباراة</button>
      ${m.link ? `<a class="vote-btn" style="display:block;text-align:center;margin-top:10px;text-decoration:none" href="${esc(m.link)}" target="_blank" rel="noopener">المشاهدة الرسمية / المصدر ↗</a>` : `<p class="modal-note" style="margin-top:10px">المشاهدة الكاملة تخضع لحقوق النقل.</p>`}
      <a class="source-link" style="margin-top:10px" href="#/broadcasters" data-action="goto-broadcasters">📺 دليل الناقلين الرسميين — من يملك حقوق هذه البطولة؟</a>`;

    const eventList = events.length
      ? events.slice(0, 20).map((d) => {
          const ty = typeOf(d);
          const who = (d.athlete && d.athlete.displayName) || (d.text || "").replace(/^Goal\s*[-:]?\s*/i, "");
          return `<div class="mc-event">
            <span class="mc-min">${esc((d.clock && d.clock.displayValue) || "—")}</span>
            <span class="mc-ico">${iconOf(ty)}</span>
            <span class="mc-what"><b>${esc(labelOf(ty))}</b><small>${esc(who)}</small></span>
            <span class="mc-side">${esc((D.teams[String((d.team || {}).id)] || {}).code || "")}</span>
          </div>`;
        }).join("")
      : `<p class="modal-note">لا توجد أحداث متاحة لهذه المباراة بعد. تابع التحديث المباشر.</p>`;

    const stats = `<div class="mc-stats">
      <div class="mc-stat-head"><span>${esc(h.code)}</span><b>إحصائيات الأحداث</b><span>${esc(a.code)}</span></div>
      ${rows.map(([label, re, ico]) => `<div class="mc-stat-row"><span>${count(m.home, re)}</span><b>${ico} ${label}</b><span>${count(m.away, re)}</span></div>`).join("")}
      <div class="mc-stat-row"><span>${ofSide(m.home).length}</span><b>إجمالي الأحداث</b><span>${ofSide(m.away).length}</span></div>
    </div><p class="modal-note" style="margin-top:10px">الإحصائيات محسوبة من أحداث المباراة المتاحة في مصدر البيانات الحي.</p>`;

    return `<div class="match-center">
      <div class="mc-tabs" role="tablist">
        <button class="mc-tab active" data-action="match-tab" data-tab="summary">الملخص</button>
        <button class="mc-tab" data-action="match-tab" data-tab="live">النقل المباشر</button>
        <button class="mc-tab" data-action="match-tab" data-tab="events">أحداث المباراة</button>
        <button class="mc-tab" data-action="match-tab" data-tab="stats">الإحصائيات</button>
        <button class="mc-tab" data-action="match-tab" data-tab="lineups">التشكيلات</button>
        <button class="mc-tab" data-action="match-tab" data-tab="comments">آراء القرّاء</button>
      </div>
      <div class="mc-panel active" data-panel="summary">${summary}</div>
      <div class="mc-panel" data-panel="live"><div class="commentary-box" data-match="${esc(m.id)}"><p class="modal-note">اضغط تبويب «النقل المباشر» لجلب التغطية النصية دقيقة بدقيقة.</p></div></div>
      <div class="mc-panel" data-panel="events">${eventList}</div>
      <div class="mc-panel" data-panel="stats">${stats}</div>
      <div class="mc-panel" data-panel="lineups"><div class="lineup-box" data-match="${esc(m.id)}"><p class="modal-note">اضغط تبويب «التشكيلات» لجلب التشكيل من المصدر.</p></div></div>
      <div class="mc-panel" data-panel="comments">${commentsHTML("match_" + m.id)}</div>
    </div>`;
  }

  function showMatch(id) {
    const m = findMatch(id);
    if (!m) return;
    const h = D.teams[m.home], a = D.teams[m.away];
    openModal(`
      ${streamEmbed(m.streamUrl) || img(D.IMG.match1, "المباراة", "modal-hero")}
      <div style="font-size:12px;color:var(--muted);font-weight:800;margin-bottom:10px">${esc(m.league)}</div>
      <div class="modal-match-score">
        <div class="tm">${badge(h)}<span>${esc(h.name)}</span></div>
        <div class="sc">${esc(m.hs)} - ${esc(m.as)}</div>
        <div class="tm">${badge(a)}<span>${esc(a.name)}</span></div>
      </div>
      ${matchCenter(m, h, a)}`, "مركز المباراة");
  }

  function showVideo(title, image) {
    openModal(`
      <div style="position:relative;height:280px;border-radius:11px;overflow:hidden;background:#000">
        ${img(image, title)}
        <div style="position:absolute;inset:0;display:grid;place-items:center;z-index:3;background:rgba(0,0,0,.35)">
          <div style="width:64px;height:64px;border-radius:50%;background:var(--primary);color:#fff;display:grid;place-items:center;font-size:24px">▶</div>
        </div>
      </div>
      <h3 style="font-size:15px;font-weight:800;margin-top:14px">${esc(title)}</h3>
      <p class="modal-note">هذا عرض تجريبي لمشغل الفيديو. يمكنك ربطه بمصدر الفيديو الخاص بك.</p>`, "فيديو");
  }

  function showOfficialVideo(v) {
    if (!v || !v.id) return;
    openModal(`
      <div class="stream-player"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?rel=0" title="${esc(v.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe></div>
      <h3 style="font-size:15px;font-weight:800;margin-top:6px">${esc(v.title)}</h3>
      <p class="modal-note">المصدر: <a class="source-link" href="${esc(v.sourceUrl || "https://www.youtube.com")}" target="_blank" rel="noopener">${esc(v.source || "القناة الرسمية")} ↗</a> · ${esc(v.kind || "فيديو رسمي")} · يُعرض بتضمين يوتيوب الرسمي ولا يُعاد بثه داخل الموقع.</p>`, "فيديو رسمي");
  }

  function showRate() {
    const players = ["محمد صلاح", "إرلينج هالاند", "المحمدي", "كول بالمر", "إيمام عاشور"];
    openModal(`<p style="font-size:13px;font-weight:700;margin-bottom:12px">من تختار كأفضل لاعب في المباراة؟</p>
      <div class="rating-options">${players.map((p) => `<button data-action="rate-save" data-name="${esc(p)}">${esc(p)}</button>`).join("")}</div>
      <p class="modal-note" id="rateNote">${(() => { const v = store.get("motm", null); return v ? "اختيارك الحالي: " + v : "اختر لاعباً واحداً"; })()}</p>`, "رجل المباراة");
  }

  /* ---------- شريط الدوريات السريع + لوحة النتائج (مقارنة بالموقعات العالمية) ---------- */
  function renderLeagueTabs() {
    const el = document.getElementById("leagueTabs");
    if (!el) return;
    const list = (D.leagues || []).slice(0, 7);
    el.innerHTML = `<button class="league-tab fav-chip ${state.showFavorites ? "active" : ""}" data-action="fav-filter">⭐ متابعتي ${getFavs().length ? "(" + getFavs().length + ")" : ""}</button>` +
      list.map((l) =>
      `<button class="league-tab" data-action="league" data-name="${esc(l.name)}">${esc(l.icon || "⚽")} ${esc(l.name)}</button>`
    ).join("");
  }

  function renderScoreTicker() {
    const el = document.getElementById("scoreTicker");
    if (!el) return;
    const list = [
      ...((D.matches && D.matches.yesterday) || []),
      ...((D.matches && D.matches.today) || []),
      ...((D.matches && D.matches.tomorrow) || [])
    ].slice(0, 14);
    el.innerHTML = `<div class="container ticker-inner">
      <span class="ticker-label"><span class="live-dot"></span> لوحة المباريات</span>
      <div class="ticker-scroll">${list.map((m) => {
        const h = D.teams[m.home] || {}, aw = D.teams[m.away] || {};
        return `<button class="ticker-item ${m.status === "live" ? "is-live" : ""}" data-action="match" data-id="${esc(m.id)}">
          <span class="t-league">${esc(m.league)}</span>
          <span class="t-team">${badge(h)} ${esc(h.code || "")}</span>
          <b class="t-score">${esc(m.hs)} - ${esc(m.as)}</b>
          <span class="t-team">${badge(aw)} ${esc(aw.code || "")}</span>
          <span class="t-time">${esc(m.status === "live" ? m.minute : matchTime(m))}</span>
        </button>`;
      }).join("")}</div>
      <a class="ticker-all" href="#/matches">اللوحة الكاملة ←</a>
    </div>`;
  }

  /* ---------- delegation ---------- */
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const a = t.dataset.action;

    if (a === "article") { location.hash = "#/news/" + t.dataset.id; closeSearch(); return; }
    if (a === "team") { closeSearch(); toast("صفحة الفريق: " + t.dataset.name + " (قريباً)"); return; }
    if (a === "league") { location.hash = "#/leagues?league=" + encodeURIComponent(t.dataset.name); return; }
    if (a === "match") { showMatch(t.dataset.id); return; }
    if (a === "video") { showVideo(t.dataset.title, t.dataset.image); return; }
    if (a === "official-video") {
      const v = (window.KORA_OFFICIAL_VIDEOS || []).find((x) => x.id === t.dataset.id);
      showOfficialVideo(v || { id: t.dataset.id, title: t.dataset.title, source: t.dataset.source, sourceUrl: t.dataset.sourceUrl, kind: t.dataset.kind });
      return;
    }
    if (a === "match-tab") {
      const box = t.closest(".match-center");
      if (box) {
        box.querySelectorAll(".mc-tab").forEach((x) => x.classList.toggle("active", x === t));
        box.querySelectorAll(".mc-panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === t.dataset.tab));
        if (t.dataset.tab === "lineups") {
          const panel = box.querySelector('[data-panel="lineups"] .lineup-box');
          if (panel && panel.dataset.loaded !== "1") {
            panel.dataset.loaded = "1";
            const m = findMatch(panel.dataset.match);
            if (m) loadLineup(panel, m);
          }
        }
        if (t.dataset.tab === "live") {
          const panel = box.querySelector('[data-panel="live"] .commentary-box');
          if (panel && panel.dataset.loaded !== "1") {
            panel.dataset.loaded = "1";
            const m = findMatch(panel.dataset.match);
            if (m) loadCommentary(panel, m);
          }
        }
      }
      return;
    }
    if (a === "commentary-refresh") {
      const box = document.querySelector('.commentary-box[data-match="' + t.dataset.id + '"]');
      const m = findMatch(t.dataset.id);
      if (box && m) loadCommentary(box, m, true);
      return;
    }
    if (a === "goto-broadcasters") { closeModal(); return; }
    if (a === "stream-fullscreen") {
      const w = t.closest(".stream-wrap");
      if (w && w.requestFullscreen) w.requestFullscreen().catch(() => {});
      return;
    }
    if (a === "follow-team") {
      const id = String(t.dataset.id);
      const favs = getFavs();
      const i = favs.indexOf(id);
      if (i >= 0) { favs.splice(i, 1); toast("تمت إزالة الفريق من متابعتي"); }
      else { favs.push(id); toast("تمت متابعة الفريق"); award(2, "متابعة فريق"); }
      store.set("favorites", favs);
      document.querySelectorAll('[data-action="follow-team"]').forEach((b) => {
        if (String(b.dataset.id) !== id) return;
        const on = isFav(id);
        b.classList.toggle("active", on);
        b.textContent = (on ? "⭐ متابَع" : "☆ متابعة") + " " + (b.dataset.name || "");
      });
      return;
    }
    if (a === "fav-filter") {
      state.showFavorites = !state.showFavorites;
      if (location.hash !== "#/matches") location.hash = "#/matches";
      else { renderMatchesPage(); renderLeagueTabs(); }
      return;
    }
    if (a === "comment-submit") {
      const box = t.closest(".comment-box");
      const name = box.querySelector(".comment-name").value.trim() || "مشارك";
      const text = box.querySelector(".comment-text").value.trim();
      if (!text) { toast("اكتب تعليقك أولاً"); return; }
      const all = getComments();
      all.push({ key: box.dataset.key, name, text, date: new Date().toLocaleString("ar-EG") });
      store.set("comments", all);
      box.outerHTML = commentsHTML(box.dataset.key);
      toast("تم نشر تعليقك");
      award(5, "تعليق جديد");
      return;
    }
    if (a === "match-details") {
      const id = t.dataset.id ||
        (D.matches.today[0] && D.matches.today[0].id) ||
        (D.matches.yesterday[0] && D.matches.yesterday[0].id) ||
        (D.matches.tomorrow[0] && D.matches.tomorrow[0].id);
      if (id) showMatch(id); else toast("لا توجد تفاصيل متاحة حالياً");
      return;
    }
    if (a === "rate-player") { showRate(); return; }
    if (a === "rate-save") {
      store.set("motm", t.dataset.name);
      document.getElementById("rateNote").textContent = "تم تسجيل اختيارك: " + t.dataset.name;
      t.parentElement.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
      t.classList.add("selected");
      toast("تم تسجيل اختيارك بنجاح");
      award(5, "اختيار رجل المباراة");
      return;
    }
    if (a === "modal-close") { closeModal(); return; }
    if (a === "open-settings") { location.hash = "#/settings"; return; }
    if (a === "notify-toggle") {
      if (!("Notification" in window)) { toast("متصفحك لا يدعم الإشعارات"); return; }
      if (store.get("notify_on", false)) { store.set("notify_on", false); toast("تم إيقاف الإشعارات"); }
      else {
        const perm = await Notification.requestPermission();
        if (perm === "granted") { store.set("notify_on", true); toast("تم تفعيل إشعارات المباريات 🔔"); pushNotify("yallaakora", "تم تفعيل الإشعارات بنجاح ⚽"); }
        else toast("لم يتم منح إذن الإشعارات");
      }
      renderSettingsPage();
      return;
    }
    if (a === "notify-test") { pushNotify("yallaakora ⚽", "إشعار تجريبي — الإشعارات تعمل بشكل صحيح!"); toast("تم إرسال الإشعار التجريبي"); return; }
    if (a === "webpush-toggle") {
      if (!getWorkerUrl()) { toast("أضف رابط Worker أولاً من لوحة التحكم"); return; }
      if (webpushState === "ready") {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
        } catch (_) {}
        store.set("webpush_on", false);
        webpushState = "off";
        toast("تم إيقاف إشعارات الخلفية");
      } else {
        await initWebPush();
        toast(webpushState === "ready" ? "تم تفعيل إشعارات الخلفية 🔔" : "تعذّر التفعيل — تأكد من إذن الإشعارات");
      }
      renderSettingsPage();
      return;
    }
    if (a === "fcm-copy") {
      try { await navigator.clipboard.writeText(fcmToken); toast("تم نسخ رمز الجهاز"); }
      catch (_) { toast("تعذّر النسخ — انسخ الرمز يدوياً"); }
      return;
    }
    if (a === "install-app") {
      const p = window.__koraInstallPrompt;
      if (p) { p.prompt(); await p.userChoice; window.__koraInstallPrompt = null; renderSettingsPage(); }
      return;
    }
    if (a === "predict") {
      const picks = store.get("predictions", {});
      picks[t.dataset.id] = t.dataset.pick;
      store.set("predictions", picks);
      renderFantasyPage();
      return;
    }
    if (a === "fantasy-save") {
      const input = document.getElementById("fantasyName");
      if (input && input.value.trim()) { store.set("fantasy_name", input.value.trim().slice(0, 20)); toast("تم حفظ اسمك في اللوحة"); renderFantasyPage(); }
      return;
    }
    if (a === "cache-clear" || a === "cache-clear-all") {
      if (a === "cache-clear-all") {
        Object.keys(localStorage).filter((k) => k.indexOf("kora_") === 0).forEach((k) => localStorage.removeItem(k));
        toast("تم مسح البيانات المحلية");
      } else {
        localStorage.removeItem("kora_" + t.dataset.key);
        toast("تم حذف المفتاح");
      }
      renderAdminPage();
      return;
    }
    if (a === "sponsor-add") {
      const name = document.getElementById("sponsorName")?.value.trim();
      const url = document.getElementById("sponsorUrl")?.value.trim();
      const logo = document.getElementById("sponsorLogo")?.value.trim() || "";
      if (!name || !/^https?:\/\//i.test(url)) { toast("أدخل الاسم ورابطاً صحيحاً يبدأ بـ https"); return; }
      const list = store.get("sponsors", []) || [];
      list.push({ name: name.slice(0, 40), url, logo });
      store.set("sponsors", list);
      toast("تمت إضافة الشريك");
      renderAdminPage();
      return;
    }
    if (a === "sponsor-remove") {
      const list = store.get("sponsors", []) || [];
      list.splice(Number(t.dataset.index), 1);
      store.set("sponsors", list);
      renderAdminPage();
      return;
    }
    if (a === "admin-save-config") {
      store.set("worker_url", (document.getElementById("cfgWorkerUrl")?.value || "").trim());
      store.set("vapid_public", (document.getElementById("cfgVapidPublic")?.value || "").trim());
      store.set("functions_url", (document.getElementById("cfgFunctionsUrl")?.value || "").trim());
      store.set("ai_endpoint", (document.getElementById("cfgAiEndpoint")?.value || "").trim());
      store.set("ads_client", (document.getElementById("cfgAdsClient")?.value || "").trim());
      store.set("ads_slot", (document.getElementById("cfgAdsSlot")?.value || "").trim());
      store.set("ads_enabled", !!(document.getElementById("cfgAdsEnabled")?.checked));
      toast("تم حفظ الإعدادات");
      const ver = new URLSearchParams(location.search).get("v");
      location.href = location.pathname + (ver ? "?v=" + encodeURIComponent(ver) : "") + location.hash;
      return;
    }
    if (a === "admin-export") {
      const data = {};
      Object.keys(localStorage).filter((k) => k.indexOf("kora_") === 0).forEach((k) => { data[k] = localStorage.getItem(k); });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "yallaakora-settings.json";
      link.click();
      URL.revokeObjectURL(link.href);
      toast("تم تصدير الإعدادات");
      return;
    }
    if (a === "refresh-live") { refreshLive(true); return; }

    if (a === "strip-tab") {
      const day = t.dataset.day;
      const id = t.dataset.strip;
      if (id === "homeStrip") { state.homeMatchDay = day; document.getElementById("homeStrip").outerHTML = stripHTML(day, id); }
      return;
    }
    if (a === "strip-scroll") {
      const scroller = t.closest(".strip-body").querySelector(".strip-scroll");
      scroller.scrollBy({ left: Number(t.dataset.dir) * 240, behavior: "smooth" });
      return;
    }
    if (a === "poll-option") {
      if (store.get("poll_vote", null)) { toast("لقد صوتت بالفعل"); return; }
      document.querySelectorAll(".poll-option").forEach((o) => o.classList.remove("selected"));
      t.classList.add("selected");
      return;
    }
    if (a === "vote") {
      const chosen = document.querySelector(".poll-option.selected");
      if (!chosen) { toast("اختر إجابة أولاً"); return; }
      store.set("poll_vote", chosen.dataset.id);
      const card = document.getElementById("pollCard");
      if (card) card.outerHTML = pollHTML();
      toast("تم تسجيل تصويتك، شكراً لك!");
      award(5, "تصويت في الاستطلاع");
      return;
    }
    if (a === "stats-tab") {
      state.statsTab = t.dataset.tab;
      const panel = document.getElementById("statsPanel");
      if (panel) panel.outerHTML = statsHTML();
      return;
    }
    if (a === "news-filter") {
      state.newsShown = 8;
      const qs = "cat=" + encodeURIComponent(t.dataset.cat);
      const target = "#/news?" + qs;
      if (location.hash === target) renderNewsPage(new URLSearchParams(qs));
      else location.hash = target;
      return;
    }
    if (a === "load-more") { state.newsShown += 8; renderNewsPage(new URLSearchParams(location.hash.split("?")[1] || "")); return; }
  });

  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "citySelect") {
      store.set("city", e.target.value);
      const c = getCity();
      const pill = document.getElementById("cityPill");
      if (pill) pill.textContent = "📍 " + c.label;
      toast("التوقيت الآن حسب مدينة " + c.label);
      route();
    } else if (e.target && e.target.classList && e.target.classList.contains("hls-quality")) {
      if (window.__koraHls) window.__koraHls.currentLevel = Number(e.target.value);
    }
  });

  /* ---------- router ---------- */
  function route() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, qs] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    const query = new URLSearchParams(qs || "");

    document.querySelectorAll("[data-nav]").forEach((a) => {
      const seg = a.getAttribute("data-nav").replace("#/", "");
      a.classList.toggle("active", parts[0] === seg || (parts[0] === "news" && seg === "news"));
    });

    const key = parts[0] || "home";
    const SEO_PAGES = {
      home: ["", "أخبار ومباريات ونتائج كرة القدم — تغطية حية ودقيقة بدقيقة لكل البطولات."],
      matches: ["مركز المباريات", "نتائج ومواعيد كل المباريات في مختلف الدوريات مع تحديث حي."],
      news: ["الأخبار الرياضية", "آخر أخبار كرة القدم والانتقالات والتحليلات."],
      egypt: ["الدوري المصري الممتاز", "مواعيد ونتائج الدوري المصري الممتاز وجولاته."],
      brief: ["الملخص اليومي", "ملخص تلقائي لأحداث اليوم من البيانات الحية."],
      fantasy: ["مسابقة التوقعات", "توقع نتائج المباريات واجمع النقاط."],
      sources: ["المصادر الرسمية", "مصادر الفيديو والبيانات المرخّصة والموثّقة."],
      broadcasters: ["الناقلون الرسميون", "دليل حقوق بث البطولات في الشرق الأوسط وشمال أفريقيا."],
      settings: ["الإعدادات والإشعارات", "اضبط توقيت المباريات والإشعارات حسب مدينتك."],
      profile: ["ملفي ونقاطي", "مستواك ونقاطك وتفاعلك مع yallaakora."],
      admin: ["لوحة التحكم", "حالة المصادر والإعدادات المحلية لـ yallaakora."]
    };
    const seo = SEO_PAGES[key] || [];
    setSEO({ title: seo[0] || "", desc: seo[1] });
    initAds();

    renderLeagueTabs();
    if (key === "home") { renderHome(); fillEgyptHome(); }
    else if (key === "news") parts[1] ? renderArticle(parts[1]) : renderNewsPage(query);
    else if (key === "matches") renderMatchesPage();
    else if (key === "leagues") renderLeagues(query);
    else if (key === "search") renderSearchPage(query);
    else if (key === "sources") renderSourcesPage();
    else if (key === "broadcasters") renderBroadcastersPage();
    else if (key === "egypt") renderEgyptPage();
    else if (key === "brief") renderBriefPage();
    else if (key === "fantasy") renderFantasyPage();
    else if (key === "settings") renderSettingsPage();
    else if (key === "profile") renderProfilePage();
    else if (key === "admin") renderAdminPage();
    else renderSimplePage(key);

    if (location.hash !== "#/") window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ---------- تحديث البيانات الحية ---------- */
  async function refreshLive(showToast) {
    if (!window.KORA_LIVE) return;
    const status = document.getElementById("dataStatus");
    status.textContent = "جارٍ التحديث...";
    try {
      let data = await window.KORA_LIVE.load();
      if (window.KORA_ENRICH) {
        try { data = await window.KORA_ENRICH.load(data); } catch (err) { console.warn("Enrichment unavailable:", err); }
      }
      D = data;
      renderLeagueTabs();
      renderScoreTicker();
      route();
      checkKickoffs();
      settlePredictions();
      status.classList.remove("error");
      status.textContent = "بيانات حية · " + new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
      if (showToast) toast("تم تحديث البيانات من المصدر الحي");
    } catch (err) {
      status.textContent = "بيانات تجريبية";
      status.classList.add("error");
      if (showToast) toast("تعذر تحديث البيانات، يتم عرض النسخة التجريبية");
      console.warn("Live data unavailable:", err);
    }
  }

  /* محاكاة الدقيقة فقط في الوضع التجريبي */
  setInterval(() => {
    if (document.hidden || D.liveMode) return;
    state.liveMinute = state.liveMinute >= 90 ? 46 : state.liveMinute + 1;
    document.querySelectorAll("[data-live-minute]").forEach((el) => { el.textContent = state.liveMinute + "'"; });
  }, 20000);

  /* ---------- boot ---------- */
  fcmToken = store.get("fcm_token", "");
  fcmState = fcmToken ? "ready" : "off";
  webpushState = store.get("webpush_on", false) ? "ready" : "off";
  initChrome();
  renderLeagueTabs();
  renderScoreTicker();
  if (!location.hash) location.hash = "#/";
  window.addEventListener("hashchange", route);
  route();
  refreshLive(true);
  setInterval(() => { if (!document.hidden) refreshLive(false); }, 5 * 60 * 1000);

  /* تثبيت الموقع كتطبيق (PWA) + العمل دون اتصال + FCM اختياري */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      const f = CFG.firebase || {};
      const q = new URLSearchParams();
      if (f.apiKey && f.messagingSenderId && f.appId) {
        q.set("senderId", f.messagingSenderId);
        q.set("appId", f.appId);
      }
      const worker = getWorkerUrl();
      if (worker) q.set("worker", worker);
      const swUrl = "./sw.js" + (q.toString() ? "?" + q.toString() : "");
      navigator.serviceWorker.register(swUrl)
        .then(() => { if (worker) initWebPush(); else if (fcmConfigured()) initFCM(); })
        .catch(() => {});
    });
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    window.__koraInstallPrompt = e;
    if ((location.hash || "").includes("settings")) renderSettingsPage();
  });
})();
