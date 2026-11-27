"use client";

import { useEffect, useRef, useState } from "react";

type SearchItem = { title: string; excerpt: string; href: string; type: "خبر" | "مباراة"; meta: string };

const NAV = [
  { href: "/", label: "الرئيسية", icon: "🏠" },
  { href: "/matches", label: "المباريات", icon: "⚽" },
  { href: "/news", label: "الأخبار", icon: "📰" },
  { href: "/sources", label: "المصادر", icon: "🎥" },
];

const POLL = {
  question: "من الأقوى هذا الموسم؟",
  options: [
    { id: "egy", label: "الأندية المصرية", votes: 312 },
    { id: "ksa", label: "الأندية السعودية", votes: 486 },
    { id: "eur", label: "الأندية الأوروبية", votes: 641 },
    { id: "caf", label: "الأندية الأفريقية", votes: 208 },
  ],
};

const VAPID = "BK9Uk4Wa1vj7poRO7kCW8xvpY9_GmyIw7IEqmPLcwIMPf2ZK8K2ZX1jrD3iinzoUg2y8uWxLTdqKuJQeG9O5nOI";
const PUSH_API = "https://yallakora-push.yallakora.workers.dev";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

function urlB64ToUint8Array(key: string) {
  const pad = key.length % 4 ? "=".repeat(4 - (key.length % 4)) : "";
  const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const [clock, setClock] = useState("--:--:--");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [pollVote, setPollVote] = useState<string>("");
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [notif, setNotif] = useState<string>("");
  const [showTop, setShowTop] = useState(false);
  const [toast, setToast] = useState("");
  const [activePath, setActivePath] = useState("/");
  const inputRef = useRef<HTMLInputElement>(null);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  useEffect(() => {
    const saved = localStorage.getItem("kora_theme");
    const initial = saved === "dark" || (!saved && window.matchMedia?.("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
    setPollVote(localStorage.getItem("kora_poll") || "");
    setActivePath(window.location.pathname);

    const tick = () => setClock(new Intl.DateTimeFormat("ar-EG", {
      timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(new Date()));
    tick();
    const timer = window.setInterval(tick, 1000);

    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    const onInstall = (e: any) => { e.preventDefault(); setInstallEvent(e); };
    const onScroll = () => setShowTop(window.scrollY > 500);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    window.setTimeout(() => inputRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSearchOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) { setResults([]); setSearching(false); return; }
    const ctrl = new AbortController();
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const j = await r.json();
        setResults(Array.isArray(j.items) ? j.items : []);
      } catch { /* ignorable */ } finally { setSearching(false); }
    }, 220);
    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [query, searchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("kora_theme", next);
    document.documentElement.dataset.theme = next;
  }

  async function installApp() {
    if (!installEvent) { notify("استخدم زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»"); return; }
    installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  async function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) { notify("متصفحك لا يدعم الإشعارات"); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setNotif("مرفوضة"); notify("لازم تسمح بالإشعارات من المتصفح"); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID) });
      let id = localStorage.getItem("kora_push_id") || "";
      if (!id) { id = "wp_" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("kora_push_id", id); }
      const res = await fetch(`${PUSH_API}/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, endpoint: sub.endpoint, city: "cairo", favorites: JSON.parse(localStorage.getItem("kora_favs") || "[]") }),
      });
      setNotif(res.ok ? "مفعّلة" : "تعذّر التسجيل");
      notify(res.ok ? "تم تفعيل الإشعارات ✅" : "تعذّر تسجيل الإشعارات");
    } catch { setNotif("خطأ"); notify("تعذّر تفعيل الإشعارات"); }
  }

  function vote(id: string) {
    if (pollVote) return;
    setPollVote(id);
    localStorage.setItem("kora_poll", id);
    notify("تم تسجيل صوتك شكراً ⚽");
  }

  const totalVotes = POLL.options.reduce((s, o) => s + o.votes + (pollVote === o.id ? 1 : 0), 0);

  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <span>⚽ تغطية عربية حية — تحديث مباشر من ESPN</span>
          <span className="topbar-links">
            <span className="clock" dir="ltr">🕒 {clock}</span>
            <a href="/sources">مصادر قانونية</a>
          </span>
        </div>
      </div>

      <header className="site-header">
        <div className="container header-inner">
          <a href="/" className="brand" aria-label="yallaakora الرئيسية">
            <span className="brand-ball">⚽</span>
            <span>yallaa<b>kora</b></span>
          </a>
          <div className="header-actions">
            <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="بحث" title="بحث (/)" >🔍</button>
            <button className="icon-btn" onClick={toggleTheme} aria-label="تغيير المظهر" title="مظهر ليلي/نهاري">{theme === "dark" ? "☀️" : "🌙"}</button>
            <button className="icon-btn install-btn" onClick={installApp} aria-label="تثبيت التطبيق" title="تثبيت التطبيق">📲</button>
            <button className="menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="القائمة" aria-expanded={menuOpen}>{menuOpen ? "✕" : "☰"}</button>
          </div>
        </div>
        <nav className={`main-nav ${menuOpen ? "open" : ""}`} aria-label="القائمة الرئيسية">
          <div className="container" style={{ display: "flex", gap: 4 }}>
            {NAV.map((n) => (
              <a href={n.href} key={n.href} className={activePath === n.href ? "active" : ""} onClick={() => setMenuOpen(false)}>
                <span aria-hidden="true">{n.icon}</span> {n.label}
              </a>
            ))}
            <a href="/#poll" onClick={() => setMenuOpen(false)}>🗳️ استطلاع</a>
          </div>
        </nav>
      </header>

      <main id="main">{children}</main>

      <section className="container poll-section" id="poll">
        <div className="card poll-card">
          <div className="poll-head">
            <div>
              <span className="tag">🗳️ رأي الجماهير</span>
              <h2>{POLL.question}</h2>
            </div>
            <span className="meta">{totalVotes.toLocaleString("ar-EG")} صوت</span>
          </div>
          <div className="poll-options">
            {POLL.options.map((o) => {
              const votes = o.votes + (pollVote === o.id ? 1 : 0);
              const pct = Math.round((votes / totalVotes) * 100);
              return (
                <button key={o.id} className={`poll-option ${pollVote === o.id ? "mine" : ""}`} onClick={() => vote(o.id)} disabled={!!pollVote}>
                  <span className="poll-bar" style={{ width: `${pct}%` }} />
                  <span className="poll-label">{pollVote === o.id ? "✓ " : ""}{o.label}</span>
                  <span className="poll-pct" dir="ltr">{pct}%</span>
                </button>
              );
            })}
          </div>
          <div className="poll-foot">
            <button className="link-btn" onClick={enableNotifications}>🔔 {notif ? `الإشعارات: ${notif}` : "فعّل إشعارات المباريات"}</button>
            <button className="link-btn" onClick={installApp}>📲 تثبيت التطبيق</button>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <div className="footer-brand">yallaakora</div>
            <div>أخبار رياضية مترجمة للعربية من مصادر عامة. لا نبث أي محتوى غير مرخّص.</div>
          </div>
          <div className="footer-links">
            <a href="/">الرئيسية</a> · <a href="/matches">المباريات</a> · <a href="/news">الأخبار</a> · <a href="/sources">المصادر</a>
          </div>
          <div className="footer-links">
            <a href="https://github.com/o16485972-lab/yallakora" target="_blank" rel="noopener noreferrer">GitHub ↗</a> ·
            <a href={`${API_BASE}/api/hello`}>API</a>
          </div>
        </div>
      </footer>

      {showTop ? <button className="to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="العودة للأعلى">↑</button> : null}
      {toast ? <div className="toast" role="status" aria-live="polite">{toast}</div> : null}

      {searchOpen ? (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label="بحث في يالااكورة" onClick={() => setSearchOpen(false)}>
          <div className="search-panel" onClick={(e) => e.stopPropagation()}>
            <div className="search-box">
              <span>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث عن فريق، مباراة أو خبر…"
                aria-label="كلمة البحث"
              />
              <button onClick={() => setSearchOpen(false)} aria-label="إغلاق">✕</button>
            </div>
            <div className="search-results">
              {searching ? <p className="meta">جارٍ البحث…</p> : null}
              {!searching && query.trim().length >= 2 && !results.length ? <p className="meta">لا توجد نتائج. جرّب كلمة أخرى.</p> : null}
              {query.trim().length < 2 ? <p className="meta">اكتب حرفين على الأقل للبحث في الأخبار والمباريات.</p> : null}
              {results.map((r, i) => (
                <a href={r.href} className="search-item" key={`${r.href}-${i}`} onClick={() => setSearchOpen(false)}>
                  <span className="tag">{r.type}</span>
                  <strong>{r.title}</strong>
                  <span className="meta">{r.meta} — {r.excerpt}</span>
                </a>
              ))}
            </div>
            <div className="search-hint">اضغط <kbd>Esc</kbd> للإغلاق · <kbd>/</kbd> لفتح البحث</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
