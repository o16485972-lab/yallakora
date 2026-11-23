/* ============================================================
   yallaakora - طبقة البيانات الحية
   تجمع البيانات من واجهات ESPN الرياضية العامة وترجمها للعربية
   ============================================================ */
(function () {
  "use strict";

  const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
  const WEB = "https://site.web.api.espn.com/apis/v2/sports/soccer/";
  const CORE = "https://sports.core.api.espn.com/v2/sports/soccer/";
  const TRANS = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=";

  const LEAGUES = [
    { key: "eng.1", ar: "الدوري الإنجليزي", icon: "🏴" },
    { key: "esp.1", ar: "الدوري الإسباني", icon: "🇪🇸" },
    { key: "ita.1", ar: "الدوري الإيطالي", icon: "🇮🇹" },
    { key: "ger.1", ar: "الدوري الألماني", icon: "🇩🇪" },
    { key: "fra.1", ar: "الدوري الفرنسي", icon: "🇫🇷" },
    { key: "ksa.1", ar: "الدوري السعودي", icon: "🇸🇦" },
    { key: "caf.champions", ar: "دوري أبطال أفريقيا", icon: "🏆" },
    { key: "uefa.champions", ar: "دوري أبطال أوروبا", icon: "⭐" }
  ];

  async function fetchJSON(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("HTTP " + res.status + " - " + url);
    return res.json();
  }

  /* ترجمة دفعات: نفصل النصوص بفاصل ثابت ثم نقسم النتيجة */
  async function translateAll(texts) {
    const list = texts.map((t) => String(t || ""));
    const out = new Array(list.length).fill("");
    const positions = new Map();
    list.forEach((t, i) => {
      if (!t) return;
      if (!positions.has(t)) positions.set(t, []);
      positions.get(t).push(i);
    });
    const unique = [...positions.keys()];
    for (let i = 0; i < unique.length; i += 15) {
      const chunk = unique.slice(i, i + 15);
      try {
        const json = await fetchJSON(TRANS + encodeURIComponent(chunk.join(" ||| ")));
        const parts = ((json[0] || []).map((x) => x[0]).join("")).split(" ||| ");
        chunk.forEach((t, k) => {
          const value = (parts[k] || "").trim() || t;
          positions.get(t).forEach((idx) => { out[idx] = value; });
        });
      } catch (_) {
        chunk.forEach((t) => positions.get(t).forEach((idx) => { out[idx] = t; }));
      }
    }
    return out;
  }

  function dateKey(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  }

  function timeOf(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "--:--";
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function dateOf(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.getDate() + " " + d.toLocaleString("ar-EG", { month: "long" }) + " " + d.getFullYear();
  }

  function textColor(hex) {
    try {
      const h = String(hex || "").replace("#", "");
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 165 ? "#111827" : "#ffffff";
    } catch (_) { return "#ffffff"; }
  }

  function stateOf(ev) {
    const n = (ev.status && ev.status.type && ev.status.type.name) || "";
    if (n === "STATUS_IN_PROGRESS" || n === "STATUS_HALFTIME" || n === "STATUS_END_PERIOD") return "live";
    if (ev.status && ev.status.type && ev.status.type.completed) return "finished";
    if (n === "STATUS_FULL_TIME" || n === "STATUS_FINAL") return "finished";
    return "upcoming";
  }

  function teamFrom(comp, teams, sourceNames, namesMap) {
    if (!comp || !comp.team) return null;
    const id = String(comp.team.id);
    const english = comp.team.displayName || comp.team.name || "Team";
    sourceNames.push(english);
    teams[id] = {
      name: english,
      code: comp.team.abbreviation || english.slice(0, 2),
      c1: "#" + String(comp.team.color || "334155").replace("#", ""),
      c2: textColor(comp.team.color),
      logo: comp.team.logo
    };
    return id;
  }

  function buildMatches(dayResults, leagueNames, namesMap) {
    const teams = {};
    const rawNames = [];
    const grouped = { yesterday: [], today: [], tomorrow: [] };

    dayResults.forEach((r) => {
      if (!r.json || !r.json.events) return;
      const leagueLabel = r.league.ar;
      r.json.events.forEach((ev) => {
        const comp = (ev.competitions && ev.competitions[0]) || {};
        const cs = comp.competitors || [];
        const homeC = cs.find((c) => c.homeAway === "home") || cs[0];
        const awayC = cs.find((c) => c.homeAway === "away") || cs[1];
        if (!homeC || !awayC) return;
        const hid = teamFrom(homeC, teams, rawNames);
        const aid = teamFrom(awayC, teams, rawNames);
        if (!hid || !aid) return;
        const st = stateOf(ev);
        grouped[r.day].push({
          id: "lv-" + r.league.key.replace(/\W/g, "") + "-" + ev.id + "-" + r.day,
          league: leagueLabel,
          home: hid,
          away: aid,
          hs: homeC.score != null ? homeC.score : "-",
          as: awayC.score != null ? awayC.score : "-",
          time: timeOf(ev.date),
          status: st,
          minute: st === "live" ? ((ev.status && (ev.status.displayClock || (ev.status.type && ev.status.type.shortDetail))) || "الآن") : "",
          leagueKey: r.league.key,
          link: (ev.links && ev.links[0] && ev.links[0].href) || "",
          streamUrl: ((window.KORA_STREAMS || {})[r.league.key]) || "",
          details: comp.details || []
        });
      });
    });

    Object.keys(grouped).forEach((day) => grouped[day].sort((a, b) => a.time.localeCompare(b.time)));
    return { matches: grouped, teams, rawNames };
  }

  function buildNews(articleSets, leagueMap, namesMap) {
    const seen = new Set();
    const raw = [];
    articleSets.forEach((set) => {
      const label = leagueMap[set.key] || "أخبار رياضية";
      (set.json.articles || []).forEach((a) => {
        const headline = a.headline || "";
        if (!headline || seen.has(headline)) return;
        seen.add(headline);
        const desc = a.description || a.subhead || "";
        raw.push({
          id: "lv-n" + (raw.length + 1),
          category: label,
          title: ["headline", headline],
          excerpt: ["excerpt", desc.slice(0, 180)],
          image: (a.images && a.images[0] && a.images[0].url) || "",
          date: dateOf(a.published),
          time: timeOf(a.published),
          bodyText: desc,
          link: (a.links && a.links.web && a.links.web.href) || "",
          views: 800 + ((raw.length * 613) % 18000),
          source: label
        });
      });
    });

    const strings = [];
    raw.forEach((n) => { strings.push(n.title[1], n.excerpt[1], n.bodyText); });
    return translateAll(strings).then((translated) => {
      let k = 0;
      const news = raw.map((n) => {
        const title = translated[k++] || n.title[1];
        const excerpt = translated[k++] || n.excerpt[1];
        const bodyFirst = translated[k++] || n.bodyText;
        return {
          id: n.id,
          category: n.category,
          title: title,
          excerpt: excerpt,
          image: n.image,
          date: n.date,
          time: n.time,
          views: n.views,
          link: n.link,
          body: [
            bodyFirst,
            "تستمر التغطية الرياضية لمتابعة هذا الخبر وما يرتبط به من تطورات، مع رصد ردود الفعل والتحليلات الفنية من مختلف الأوساط.",
            "وتشهد البطولات المختلفة منافسة قوية هذا الموسم، حيث تسعى الفرق إلى حصد النقاط في كل جولة لتحسين موقعها في الترتيب العام.",
            "ويمكنك متابعة كل المستجدات والنتائج المباشرة عبر الصفحات المخصصة للمباريات والدوريات في الموقع."
          ]
        };
      });
      return news.slice(0, 30);
    });
  }

  function buildStats(standingsJson, leadersJson, teams, namesMap) {
    const rawNames = [];
    const table = [];
    const entries = standingsJson && standingsJson.children && standingsJson.children[0] &&
      standingsJson.children[0].standings && standingsJson.children[0].standings.entries;
    if (entries) {
      entries.slice(0, 6).forEach((e, i) => {
        const t = e.team || {};
        const id = "table-" + (t.id || i);
        const name = t.displayName || t.name || "Team";
        rawNames.push(name);
        const stat = (n, d) => { const s = (e.stats || []).find((x) => x.name === n); return s ? (s.value != null ? s.value : (s.displayValue || d)) : d; };
        teams[id] = {
          name: name, code: t.abbreviation || name.slice(0, 2),
          c1: "#" + String(t.color || "334155").replace("#", ""), c2: textColor(t.color)
        };
        table.push({
          pos: i + 1, team: id, code: t.abbreviation || name.slice(0, 2),
          c1: teams[id].c1, c2: teams[id].c2,
          pts: stat("points", 0), p: stat("gamesPlayed", 0), w: stat("wins", 0),
          d: stat("ties", 0), l: stat("losses", 0)
        });
      });
    }

    const scorerRefs = [];
    const goalsCat = leadersJson && leadersJson.categories && leadersJson.categories.find((c) => c.name === "goals");
    if (goalsCat && goalsCat.leaders) {
      goalsCat.leaders.slice(0, 5).forEach((l) => {
        scorerRefs.push({
          value: l.value,
          athlete: l.athlete && l.athlete.$ref ? l.athlete.$ref.replace("http://", "https://") : "",
          team: l.team && l.team.$ref ? l.team.$ref.replace("http://", "https://") : ""
        });
      });
    }

    return Promise.all(scorerRefs.map(async (r) => {
      let athlete = {}, team = {};
      try { if (r.athlete) athlete = await fetchJSON(r.athlete); } catch (_) {}
      try { if (r.team) team = await fetchJSON(r.team); } catch (_) {}
      return {
        value: r.value,
        name: athlete.displayName || athlete.fullName || "لاعب",
        teamName: team.displayName || team.name || "فريق",
        code: team.abbreviation || "",
        color: "#" + String(team.color || "334155").replace("#", "")
      };
    })).then((scorers) => {
      const allNames = [...rawNames, ...scorers.flatMap((s) => [s.name, s.teamName])];
      return translateAll(allNames).then((translated) => {
        let k = 0;
        table.forEach((row) => {
          const name = translated[k++];
          teams[row.team].name = name;
          row.teamName = name;
        });
        scorers.forEach((s) => { s.name = translated[k++] || s.name; s.teamName = translated[k++] || s.teamName; });
        table.forEach((row) => { row.teamLabel = row.teamName; });
        return {
          table: table.map((row) => ({
            pos: row.pos, team: row.teamLabel, code: row.code, c1: row.c1, c2: row.c2,
            pts: row.pts, p: row.p, w: row.w, d: row.d, l: row.l
          })),
          scorers: scorers.map((s) => ({
            name: s.name, team: s.teamName, goals: s.value, code: s.code || s.teamName.slice(0, 2),
            c1: s.color, c2: textColor(s.color)
          }))
        };
      });
    });
  }

  function buildLive(liveMatches, rawNames, namesMap) {
    const live = liveMatches.find((m) => m.status === "live") || liveMatches[0];
    if (!live) return null;
    const events = [];
    (live.details || []).slice().reverse().forEach((d) => {
      const type = d.type && d.type.text ? d.type.text : "";
      let kind = "sub";
      if (/goal/i.test(type)) kind = "goal";
      else if (/yellow|card/i.test(type)) kind = "yellow";
      const txt = [type, d.text || "", d.athlete && d.athlete.displayName ? d.athlete.displayName : ""].filter(Boolean).join(" - ");
      if (txt) events.push({ min: (d.clock && d.clock.displayValue) || "", type: kind, text: txt, team: d.team && d.team.id ? String(d.team.id) : "" });
    });
    if (!events.length) events.push({ min: "", type: "sub", text: "متابعة المباراة", team: "" });
    return {
      id: live.id,
      league: live.league,
      home: live.home, away: live.away,
      hs: live.hs, as: live.as,
      minute: live.minute || "الآن",
      rawEvents: events,
      rawNames: events.map((e) => e.text)
    };
  }

  /* ---------- التحميل الرئيسي ---------- */
  async function load() {
    const base = window.KORA_DATA;
    const todayLeagues = LEAGUES;
    const otherLeagues = LEAGUES.slice(0, 4);
    const calls = [];
    todayLeagues.forEach((l) => calls.push({ day: "today", league: l, url: SITE + l.key + "/scoreboard?dates=" + dateKey(0) }));
    otherLeagues.forEach((l) => calls.push({ day: "yesterday", league: l, url: SITE + l.key + "/scoreboard?dates=" + dateKey(-1) }));
    otherLeagues.forEach((l) => calls.push({ day: "tomorrow", league: l, url: SITE + l.key + "/scoreboard?dates=" + dateKey(1) }));
    LEAGUES.slice(0, 5).forEach((l) => calls.push({ day: "news", league: l, url: SITE + l.key + "/news?limit=12" }));
    calls.push({ day: "standings", url: WEB + "eng.1/standings?region=us&lang=en&contentorigin=espn" });
    calls.push({ day: "leaders", url: CORE + "leagues/eng.1/seasons/" + new Date().getFullYear() + "/types/1/leaders?lang=en&region=us" });

    const responses = await Promise.allSettled(calls.map((c) => fetchJSON(c.url)));
    const results = calls.map((c, i) => ({ ...c, json: responses[i].status === "fulfilled" ? responses[i].value : null }));

    const scoreResults = results.filter((r) => ["today", "yesterday", "tomorrow"].includes(r.day));
    const namesMap = new Map();
    const built = buildMatches(scoreResults, LEAGUES, namesMap);
    const newsSets = results.filter((r) => r.day === "news" && r.json);
    const news = await buildNews(newsSets, Object.fromEntries(LEAGUES.map((l) => [l.key, l.ar])), namesMap);
    const standings = results.find((r) => r.day === "standings");
    const leaders = results.find((r) => r.day === "leaders");
    const stats = await buildStats(standings && standings.json ? standings.json : {}, leaders && leaders.json ? leaders.json : {}, built.teams, namesMap);

    const allEvents = [...built.matches.today, ...built.matches.yesterday, ...built.matches.tomorrow];
    const liveData = buildLive(built.matches.today, built.rawNames, namesMap);

    const translateNames = [...new Set([...built.rawNames, ...(liveData ? liveData.rawEvents : []), ...LEAGUES.map((l) => l.ar)])];
    if (liveData || built.rawNames.length) {
      const translated = await translateAll(translateNames);
      const map = new Map(translateNames.map((n, i) => [n, translated[i]]));
      Object.keys(built.teams).forEach((id) => {
        const t = built.teams[id];
        if (map.has(t.name)) t.name = map.get(t.name);
      });
      if (liveData) {
        liveData.events = liveData.rawEvents.map((e) => ({ ...e, text: map.get(e.text) || e.text }));
      }
    }

    const featured = news.slice(0, 5).map((n, i) => ({ newsId: n.id, label: n.category, item: n }));
    const reels = news.slice(0, 8).map((n, i) => ({
      id: "lr" + i, title: n.title, image: n.image, date: n.date, time: n.time, views: (8 + i * 7) + "k"
    }));
    const media = news.slice(8, 18).map((n, i) => ({
      id: "lm" + i, type: i % 3 === 0 ? "video" : "image", title: n.title, image: n.image, duration: "02:" + String(10 + i).padStart(2, "0")
    }));
    const upcoming = built.matches.today.filter((m) => m.status === "upcoming").slice(0, 3).concat(
      built.matches.tomorrow.filter((m) => m.status === "upcoming").slice(0, 2)
    ).map((m) => ({
      home: built.teams[m.home] ? built.teams[m.home].name : "فريق",
      away: built.teams[m.away] ? built.teams[m.away].name : "فريق",
      time: m.time + " " + (m.dateLabel || ""),
      hc: built.teams[m.home] ? built.teams[m.home].c1 : "#334155",
      ac: built.teams[m.away] ? built.teams[m.away].c1 : "#334155"
    }));

    return {
      ...base,
      teams: built.teams,
      matches: {
        yesterday: built.matches.yesterday,
        today: built.matches.today,
        tomorrow: built.matches.tomorrow
      },
      news: news,
      featured: featured,
      reels: reels,
      media: media,
      poll: base.poll,
      stats: { ...stats, upcoming: upcoming },
      live: liveData ? {
        id: liveData.id,
        league: liveData.league,
        home: liveData.home,
        away: liveData.away,
        hs: liveData.hs,
        as: liveData.as,
        minute: liveData.minute,
        events: liveData.events
      } : base.live,
      nav: base.nav,
      socials: base.socials,
      footerCols: base.footerCols,
      IMG: base.IMG,
      leagues: LEAGUES.map((l) => ({ name: l.ar, icon: l.icon, key: l.key, count: "—" })),
      liveMode: true,
      updatedAt: new Date().toISOString()
    };
  }

  window.KORA_LIVE = { load: load, leagues: LEAGUES };
})();
