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

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);

  const img = (src, alt, cls) =>
    `<div class="img-wrap ${cls || ""}"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="this.style.display='none'"></div>`;

  function streamEmbed(url) {
    if (!url) return "";
    const u = String(url).trim();
    const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
    const isHls = /\.m3u8(\?|$)/i.test(u);
    if (yt) {
      return `<div class="stream-player"><iframe src="https://www.youtube.com/embed/${yt[1]}?rel=0" title="بث المباراة" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    }
    if (isHls) {
      return `<div class="stream-player"><video id="liveStreamVideo" data-src="${esc(u)}" controls playsinline></video></div>`;
    }
    if (/^https?:\/\//i.test(u)) {
      return `<div class="stream-player"><iframe src="${esc(u)}" title="بث المباراة" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    }
    return "";
  }

  function initStreamPlayer() {
    const v = document.getElementById("liveStreamVideo");
    if (!v) return;
    const url = v.dataset.src;
    if (!url) return;
    if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = url; return; }
    if (window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls(); hls.loadSource(url); hls.attachMedia(v); return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js";
    s.onload = () => {
      if (window.Hls && window.Hls.isSupported()) {
        const hls = new window.Hls(); hls.loadSource(url); hls.attachMedia(v);
      }
    };
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
      "الدوري المصري": "#/leagues?league=الدوري%20المصري", "الدوري الإنجليزي": "#/leagues?league=الدوري%20الإنجليزي",
      "الدوري الإسباني": "#/leagues?league=الدوري%20الإسباني", "دوري أبطال أفريقيا": "#/leagues?league=دوري%20أبطال%20أفريقيا",
      "الدوري السعودي": "#/leagues?league=الدوري%20السعودي", "من نحن": "#/about",
      "اتصل بنا": "#/contact", "للإعلان معنا": "#/advertise", "سياسة الخصوصية": "#/policy"
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
      <div class="match-time ${m.status === "live" ? "live-time" : ""}">${m.status === "live" ? "جارية الآن" : esc(m.time)}</div>
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
        <span class="when">${esc(u.time)}</span>
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

  /* ---------- views ---------- */
  function renderHome() {
    const latest = D.news.slice(0, 8);
    view.innerHTML = `
      <section class="section">${stripHTML(state.homeMatchDay, "homeStrip")}</section>
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
                <span class="when">${esc(u.time)}</span>
                <span class="tm"><span class="team-badge" style="--c1:${u.ac};--c2:#fff">${esc(u.away.charAt(0))}</span>${esc(u.away)}</span>
              </div>`).join("")}
            </div>
          </div>
        </div>
      </section>
      <section class="section">
        ${sectionHead("صور وفيديوهات", "#/media")}
        ${mediaGridHTML(D.media.slice(0, 10))}
      </section>
      <section class="section">
        ${sectionHead("كلام في الكورة", "#/news")}
        <div class="news-grid">${D.news.slice(8, 16).map(newsCard).join("")}</div>
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
      about: ["من نحن", "منصة عربية للإعلام الرياضي", () => `<div class="card" style="padding:24px;line-height:2;color:var(--ink-2)"><p>yallaakora منصة رياضية عربية تهدف إلى تقديم أخبار كرة القدم والرياضات الأخرى بصورة سريعة وموثوقة، مع تغطية المباريات والنتائج المباشرة والتحليلات.</p><p>نسعى إلى توفير تجربة استخدام سهلة على كل الأجهزة، مع محتوى متجدد على مدار اليوم.</p></div>`],
      contact: ["اتصل بنا", "نسمع رأيك دائماً", () => `<div class="card" style="padding:24px"><p>للتواصل مع فريق التحرير: <b>hello@koralive.example</b></p><p>للإعلانات والشراكات: <b>ads@koralive.example</b></p></div>`],
      policy: ["سياسة الخصوصية", "كيف نستخدم بياناتك", () => `<div class="card" style="padding:24px;line-height:2;color:var(--ink-2)"><p>نحن نحترم خصوصيتك. البيانات التي تدخلها مثل بريدك الإلكتروني تُحفظ محلياً على جهازك لأغراض الاشتراك في الإشعارات فقط، ولا يتم مشاركتها مع أي طرف ثالث.</p></div>`],
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
      bits.push(`<div class="match-extra"><span class="ex-ico">🌡️</span><div class="ex-txt"><b>طقس المباراة</b><span>${esc(m.weather.temp)}° · ${esc(m.weather.desc)}</span></div></div>`);
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
    const h = String(m.homeRaw || (D.teams[m.home] || {}).name || "");
    const a = String(m.awayRaw || (D.teams[m.away] || {}).name || "");
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
      console.warn("Lineup unavailable:", m.homeRaw, m.awayRaw, err);
      box.innerHTML = `<p class="modal-note">التشكيلات غير متوفرة لهذه المباراة في مصدر البيانات حالياً.</p>`;
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
        <p>الموعد: ${esc(m.time)}</p>
        <p>الحالة: ${m.status === "live" ? "مباشر الآن" : m.status === "finished" ? "انتهت المباراة" : "لم تبدأ بعد"}</p>
        <p>البطولة: ${esc(m.league)}</p>
      </div>
      ${matchExtras(m)}
      <div class="follow-row">
        <button class="follow-btn ${isFav(m.home) ? "active" : ""}" data-action="follow-team" data-id="${esc(m.home)}" data-name="${esc(h.name)}">${isFav(m.home) ? "⭐ متابَع" : "☆ متابعة"} ${esc(h.code)}</button>
        <button class="follow-btn ${isFav(m.away) ? "active" : ""}" data-action="follow-team" data-id="${esc(m.away)}" data-name="${esc(a.name)}">${isFav(m.away) ? "⭐ متابَع" : "☆ متابعة"} ${esc(a.code)}</button>
      </div>
      <button class="vote-btn" data-action="rate-player" style="margin-top:14px">اختر رجل المباراة</button>
      ${m.link ? `<a class="vote-btn" style="display:block;text-align:center;margin-top:10px;text-decoration:none" href="${esc(m.link)}" target="_blank" rel="noopener">المشاهدة الرسمية / المصدر ↗</a>` : `<p class="modal-note" style="margin-top:10px">المشاهدة الكاملة تخضع لحقوق النقل.</p>`}`;

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
        <button class="mc-tab" data-action="match-tab" data-tab="events">أحداث المباراة</button>
        <button class="mc-tab" data-action="match-tab" data-tab="stats">الإحصائيات</button>
        <button class="mc-tab" data-action="match-tab" data-tab="lineups">التشكيلات</button>
        <button class="mc-tab" data-action="match-tab" data-tab="comments">آراء القرّاء</button>
      </div>
      <div class="mc-panel active" data-panel="summary">${summary}</div>
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
          <span class="t-time">${esc(m.status === "live" ? m.minute : m.time)}</span>
        </button>`;
      }).join("")}</div>
      <a class="ticker-all" href="#/matches">اللوحة الكاملة ←</a>
    </div>`;
  }

  /* ---------- delegation ---------- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const a = t.dataset.action;

    if (a === "article") { location.hash = "#/news/" + t.dataset.id; closeSearch(); return; }
    if (a === "team") { closeSearch(); toast("صفحة الفريق: " + t.dataset.name + " (قريباً)"); return; }
    if (a === "league") { location.hash = "#/leagues?league=" + encodeURIComponent(t.dataset.name); return; }
    if (a === "match") { showMatch(t.dataset.id); return; }
    if (a === "video") { showVideo(t.dataset.title, t.dataset.image); return; }
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
      }
      return;
    }
    if (a === "follow-team") {
      const id = String(t.dataset.id);
      const favs = getFavs();
      const i = favs.indexOf(id);
      if (i >= 0) { favs.splice(i, 1); toast("تمت إزالة الفريق من متابعتي"); }
      else { favs.push(id); toast("تمت متابعة الفريق"); }
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
      return;
    }
    if (a === "modal-close") { closeModal(); return; }
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

    renderLeagueTabs();
    const key = parts[0] || "home";
    if (key === "home") renderHome();
    else if (key === "news") parts[1] ? renderArticle(parts[1]) : renderNewsPage(query);
    else if (key === "matches") renderMatchesPage();
    else if (key === "leagues") renderLeagues(query);
    else if (key === "search") renderSearchPage(query);
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
      status.classList.remove("error");
      status.textContent = "بيانات حية · " + new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
      route();
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
  initChrome();
  renderLeagueTabs();
  renderScoreTicker();
  if (!location.hash) location.hash = "#/";
  window.addEventListener("hashchange", route);
  route();
  refreshLive(true);
  setInterval(() => { if (!document.hidden) refreshLive(false); }, 5 * 60 * 1000);
})();
