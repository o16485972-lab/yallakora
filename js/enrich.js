/* ============================================================
   yallaakora - إثراء البيانات الحية
   ------------------------------------------------------------
   1) شعارات الفرق من TheSportsDB (أثبت من صور ESPN اللي بتتكسر)
   2) قناة البث الرسمية لكل مباراة من TheSportsDB / eventstv
   3) °حرارة مدينة البطولة من Open-Meteo (بدون مفتاح)
   كل المكالمات اختيارية وفاشلها ما بيوقفش الموقع.
   ============================================================ */
(function () {
  "use strict";

  const TSDB = "https://www.thesportsdb.com/api/v1/json/123/";
  const LEAGUES = {
    "eng.1": "English Premier League",
    "esp.1": "Spanish La Liga",
    "ita.1": "Italian Serie A",
    "ger.1": "German Bundesliga",
    "fra.1": "French Ligue 1",
    "ksa.1": "Saudi Professional League",
    "caf.champions": "CAF Champions League",
    "uefa.champions": "UEFA Champions League"
  };
  const CITIES = {
    "eng.1": [51.5074, -0.1278],
    "esp.1": [40.4168, -3.7038],
    "ita.1": [45.4642, 9.1900],
    "ger.1": [52.5200, 13.4050],
    "fra.1": [48.8566, 2.3522],
    "ksa.1": [24.7136, 46.6753],
    "caf.champions": [30.0444, 31.2357],
    "uefa.champions": [48.8566, 2.3522]
  };
  const STOP = new Set(["fc", "ac", "afc", "cf", "sc", "club", "the", "cd", "ss"]);

  async function get(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  function tokens(s) {
    return String(s || "").toLowerCase().normalize("NFKD")
      .replace(/[\u064b-\u065f]/g, "")
      .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
      .split(/\s+/).filter((x) => x && !STOP.has(x));
  }
  const tkey = (a) => a.slice().sort().join(" ");
  function score(a, b) {
    if (!a.length || !b.length) return 0;
    const setB = new Set(b);
    let hit = 0;
    a.forEach((x) => { if (setB.has(x)) hit++; });
    return (2 * hit) / (a.length + b.length);
  }
  function best(needle, pool, pick) {
    if (!needle.length) return null;
    const k = tkey(needle);
    for (const item of pool) { if (tkey(item.tokens) === k) return pick(item); }
    let winner = null, top = 0.62;
    pool.forEach((item) => {
      const s = score(needle, item.tokens);
      if (s > top) { top = s; winner = item; }
    });
    return winner ? pick(winner) : null;
  }

  function day(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  const WEATHER = {
    0: "صافٍ", 1: "غائم جزئياً", 2: "غائم جزئياً", 3: "غائم",
    45: "ضباب", 48: "ضباب",
    51: "رذاذ", 53: "رذاذ", 55: "رذاذ", 56: "رذاذ", 57: "رذاذ",
    61: "مطر", 63: "مطر", 65: "مطر غزير", 66: "مطر", 67: "مطر",
    71: "ثلوج", 73: "ثلوج", 75: "ثلوج", 77: "ثلوج",
    80: "زخات مطر", 81: "زخات مطر", 82: "زخات غزيرة",
    95: "عاصفة", 96: "عاصفة", 99: "عاصفة"
  };

  async function load(data) {
    const usedKeys = new Set();
    ["yesterday", "today", "tomorrow"].forEach((d) =>
      (data.matches && data.matches[d] || []).forEach((m) => usedKeys.add(m.leagueKey))
    );
    if (data.live && data.live.leagueKey) usedKeys.add(data.live.leagueKey);

    /* 1) شعارات الفرق */
    const leagueKeys = Object.keys(LEAGUES).filter((k) => usedKeys.has(k));
    const teamRequests = await Promise.allSettled(leagueKeys.map((k) =>
      get(TSDB + "search_all_teams.php?l=" + encodeURIComponent(LEAGUES[k]))
    ));
    const badgePool = [];
    teamRequests.forEach((res) => {
      (res.status === "fulfilled" && res.value.teams || []).forEach((t) => {
        if (t.strBadge) badgePool.push({ tokens: tokens(t.strTeam), badge: t.strBadge });
      });
    });
    const badgeOf = (name) => best(tokens(name), badgePool, (x) => x.badge);

    /* 2) قنوات البث الرسمية */
    const tvRequests = await Promise.allSettled([-1, 0, 1].map((o) =>
      get(TSDB + "eventstv.php?d=" + day(o) + "&s=Soccer")
    ));
    const tvPool = [];
    tvRequests.forEach((res) => {
      (res.status === "fulfilled" && res.value.tvevents || []).forEach((e) => {
        const parts = String(e.strEvent || "").split(/\s+vs\.?\s+/i);
        if (parts.length < 2) return;
        tvPool.push({
          home: tokens(parts[0]), away: tokens(parts[1]),
          channel: e.strChannel || "", country: e.strCountry || "",
          logo: e.strLogo || "", time: e.strTime || ""
        });
      });
    });
    const tvOf = (home, away) => {
      const h = tokens(home), a = tokens(away);
      if (!h.length || !a.length) return null;
      let winner = null, top = 1.15;
      tvPool.forEach((e) => {
        const s = score(h, e.home) + score(a, e.away);
        if (s > top) { top = s; winner = e; }
      });
      return winner;
    };

    /* 3) طقس كل بطولة مستخدمة */
    const cityKeys = [...usedKeys].filter((k) => CITIES[k]);
    const weatherRequests = await Promise.allSettled(cityKeys.map((k) => {
      const c = CITIES[k];
      return get("https://api.open-meteo.com/v1/forecast?latitude=" + c[0] + "&longitude=" + c[1] +
        "&current=temperature_2m,weather_code&timezone=auto");
    }));
    const weather = {};
    cityKeys.forEach((k, i) => {
      const r = weatherRequests[i];
      if (r.status !== "fulfilled" || !r.value.current) return;
      const code = r.value.current.weather_code;
      weather[k] = {
        temp: Math.round(r.value.current.temperature_2m),
        desc: WEATHER[code] || "طقس معتدل"
      };
    });

    /* تطبيق النتائج */
    Object.keys(data.teams || {}).forEach((id) => {
      const t = data.teams[id];
      const logo = badgeOf(t.rawName || t.name);
      if (logo) t.logo = logo;
    });
    const decorate = (m) => {
      const h = (data.teams[m.home] || {}).rawName || "";
      const a = (data.teams[m.away] || {}).rawName || "";
      m.tv = tvOf(m.homeRaw || h, m.awayRaw || a);
      m.weather = weather[m.leagueKey] || null;
    };
    ["yesterday", "today", "tomorrow"].forEach((d) =>
      (data.matches && data.matches[d] || []).forEach(decorate)
    );
    if (data.live) decorate(data.live);
    return data;
  }

  window.KORA_ENRICH = { load: load };
})();
