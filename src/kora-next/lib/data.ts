/* yallaakora - طبقة بيانات الخادم (SSR/ISR)
   مصادر قانونية/عامة: ESPN + Google Translate. لا يوجد أي بث غير مرخّص. */

export const LEAGUES = [
  { key: "eng.1", ar: "الدوري الإنجليزي", icon: "🏴" },
  { key: "esp.1", ar: "الدوري الإسباني", icon: "🇪🇸" },
  { key: "ita.1", ar: "الدوري الإيطالي", icon: "🇮🇹" },
  { key: "ger.1", ar: "الدوري الألماني", icon: "🇩🇪" },
  { key: "fra.1", ar: "الدوري الفرنسي", icon: "🇫🇷" },
  { key: "ksa.1", ar: "الدوري السعودي", icon: "🇸🇦" },
  { key: "caf.champions", ar: "دوري أبطال أفريقيا", icon: "🏆" },
  { key: "uefa.champions", ar: "دوري أبطال أوروبا", icon: "⭐" },
] as const;

const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
const TRANS_ENDPOINTS = [
  (q: string) => `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=ar&q=${encodeURIComponent(q)}`,
  (q: string) => `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(q)}`,
  (q: string) => `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|ar`,
];

export type MatchStatus = "live" | "finished" | "upcoming";
export type Match = {
  id: string;
  league: string;
  leagueKey: string;
  home: string;
  away: string;
  homeCode: string;
  awayCode: string;
  homeLogo: string;
  awayLogo: string;
  hs: string | number;
  as: string | number;
  time: string;
  iso: string;
  status: MatchStatus;
  minute: string;
  link: string;
};

export type NewsItem = {
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  date: string;
  source: string;
  link: string;
  body: string[];
};

async function fetchJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 yallaakora" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return (await res.json()) as T;
}

/** ترجمة دفعات لتقليل عدد الطلبات، مع بديل مجاني إذا قيّدت Google الطلبات */
function parsedTranslation(json: any): string {
  if (typeof json === "string") return json;
  if (Array.isArray(json)) {
    if (typeof json[0] === "string") return json[0];
    const segments = Array.isArray(json[0]) ? json[0] : [];
    return segments.map((x: any) => (Array.isArray(x) ? x[0] : x) || "").join("");
  }
  return typeof json?.responseData?.translatedText === "string" ? json.responseData.translatedText : "";
}

export async function translateMany(texts: string[]): Promise<string[]> {
  const list = texts.map((t) => String(t || ""));
  const out = new Array(list.length).fill("");
  const positions = new Map<string, number[]>();
  list.forEach((t, i) => {
    if (!t) return;
    if (!positions.has(t)) positions.set(t, []);
    positions.get(t)!.push(i);
  });
  const unique = [...positions.keys()];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const query = chunk.join(" ||| ");
    let done = false;
    for (const endpoint of TRANS_ENDPOINTS) {
      try {
        const translated = parsedTranslation(await fetchJson<any>(endpoint(query)));
        const parts = translated.split(/\s*\|\|\|\s*/).map((p) => p.trim());
        if (parts.length < chunk.length) continue;
        chunk.forEach((t, k) => {
          const value = parts[k] || t;
          positions.get(t)!.forEach((idx) => { out[idx] = value; });
        });
        done = true;
        break;
      } catch {
        /* جرّب البديل التالي */
      }
    }
    if (!done) chunk.forEach((t) => positions.get(t)!.forEach((idx) => { out[idx] = t; }));
  }
  return out;
}

/** بعض عناوين ESPN تكرّر مقدمتها مرتين؛ نُنظّفها قبل الترجمة وبعدها */
function dedupeLead(text: string): string {
  return String(text || "").replace(/^(.{4,80}?)\1\s*/i, "$1 ").trim();
}

function dateKey(offset: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(Date.now() + offset * 86400000));
  return parts.replace(/-/g, "");
}

function cairoTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(iso));
  } catch { return "--:--"; }
}

function arabicDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      timeZone: "Africa/Cairo", day: "numeric", month: "long", year: "numeric",
    }).format(new Date(iso));
  } catch { return ""; }
}

function statusOf(ev: any): MatchStatus {
  const name = ev?.status?.type?.name || "";
  if (["STATUS_IN_PROGRESS", "STATUS_HALFTIME", "STATUS_END_PERIOD"].includes(name)) return "live";
  if (ev?.status?.type?.completed || ["STATUS_FULL_TIME", "STATUS_FINAL"].includes(name)) return "finished";
  return "upcoming";
}

export type MatchDay = "yesterday" | "today" | "tomorrow";

export async function getMatches(): Promise<Record<MatchDay, Match[]>> {
  const calls: Array<{ day: MatchDay; key: string; league: string; url: string }> = [];
  LEAGUES.forEach((l) => calls.push({ day: "today", key: l.key, league: l.ar, url: `${SITE}${l.key}/scoreboard?dates=${dateKey(0)}` }));
  LEAGUES.slice(0, 4).forEach((l) => {
    calls.push({ day: "yesterday", key: l.key, league: l.ar, url: `${SITE}${l.key}/scoreboard?dates=${dateKey(-1)}` });
    calls.push({ day: "tomorrow", key: l.key, league: l.ar, url: `${SITE}${l.key}/scoreboard?dates=${dateKey(1)}` });
  });

  const results = await Promise.allSettled(calls.map((c) => fetchJson<any>(c.url)));
  const rawNames: string[] = [];
  const matches: Record<MatchDay, Match[]> = { yesterday: [], today: [], tomorrow: [] };

  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const call = calls[i];
    for (const ev of r.value?.events || []) {
      const comp = (ev.competitions || [])[0] || {};
      const cs = comp.competitors || [];
      const home = cs.find((c: any) => c.homeAway === "home") || cs[0];
      const away = cs.find((c: any) => c.homeAway === "away") || cs[1];
      if (!home?.team || !away?.team) continue;
      const hn = home.team.displayName || home.team.name || "فريق";
      const an = away.team.displayName || away.team.name || "فريق";
      rawNames.push(hn, an, call.league);
      const status = statusOf(ev);
      matches[call.day].push({
        id: `${call.key.replace(/\W/g, "")}-${ev.id}`,
        league: call.league,
        leagueKey: call.key,
        home: hn,
        away: an,
        homeCode: home.team.abbreviation || "",
        awayCode: away.team.abbreviation || "",
        homeLogo: home.team.logo || "",
        awayLogo: away.team.logo || "",
        hs: home.score ?? "-",
        as: away.score ?? "-",
        time: cairoTime(ev.date),
        iso: ev.date || "",
        status,
        minute: status === "live" ? (ev.status?.displayClock || ev.status?.type?.shortDetail || "الآن") : "",
        link: (ev.links || [])[0]?.href || "",
      });
    }
  });

  const translated = await translateMany([...new Set(rawNames)]);
  const map = new Map([...new Set(rawNames)].map((n, i) => [n, translated[i] || n]));
  (Object.keys(matches) as MatchDay[]).forEach((day) => {
    matches[day].forEach((m) => {
      m.home = map.get(m.home) || m.home;
      m.away = map.get(m.away) || m.away;
      m.league = map.get(m.league) || m.league;
    });
    matches[day].sort((a, b) => a.time.localeCompare(b.time));
  });
  return matches;
}

export async function getNews(limit = 14): Promise<NewsItem[]> {
  const calls = LEAGUES.slice(0, 5).map((l) => ({ key: l.key, league: l.ar, url: `${SITE}${l.key}/news?limit=10` }));
  const results = await Promise.allSettled(calls.map((c) => fetchJson<any>(c.url)));
  const seen = new Set<string>();
  const raw: Array<{ slug: string; title: string; excerpt: string; image: string; date: string; source: string; link: string; bodyText: string }> = [];

  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    for (const a of r.value?.articles || []) {
      const headline = dedupeLead(a.headline || "");
      if (!headline || seen.has(headline)) continue;
      seen.add(headline);
      const desc = dedupeLead(a.description || a.subhead || "");
      raw.push({
        slug: `n-${a.id || raw.length + 1}`,
        title: headline,
        excerpt: desc.slice(0, 180),
        image: (a.images || [])[0]?.url || "",
        date: arabicDate(a.published),
        source: calls[i].league,
        link: a.links?.web?.href || "",
        bodyText: desc,
      });
    }
  });

  const strings = raw.flatMap((n) => [n.title, n.excerpt, n.bodyText]);
  const tr = await translateMany(strings);
  const news = raw.map((n, i) => ({
    slug: n.slug,
    title: dedupeLead(tr[i * 3] || n.title),
    excerpt: dedupeLead(tr[i * 3 + 1] || n.excerpt),
    image: n.image,
    date: n.date,
    source: n.source,
    link: n.link,
    body: [
      dedupeLead(tr[i * 3 + 2] || n.bodyText),
      "تستمر التغطية الرياضية لمتابعة هذا الخبر وما يرتبط به من تطورات، مع رصد ردود الفعل والتحليلات الفنية من مختلف الأوساط.",
      "وتشهد البطولات منافسة قوية هذا الموسم، حيث تسعى الفرق لحصد النقاط في كل جولة لتحسين موقعها في الترتيب العام.",
      "يمكنك متابعة كل المستجدات والنتائج المباشرة عبر صفحات المباريات والدوريات في يالااكورة.",
    ].filter(Boolean),
  }));
  return news.slice(0, limit);
}

export async function getArticle(slug: string): Promise<NewsItem | null> {
  const news = await getNews(30);
  return news.find((n) => n.slug === slug) || null;
}

/** بيانات احتياطية تعمل حتى لو تعذّر الوصول لـ ESPN */
export const fallbackMatches: Record<MatchDay, Match[]> = {
  yesterday: [],
  today: [
    { id: "fb-1", league: "الدوري الإنجليزي", leagueKey: "eng.1", home: "أرسنال", away: "تشيلسي", homeCode: "ARS", awayCode: "CHE", homeLogo: "", awayLogo: "", hs: 2, as: 1, time: "21:00", iso: "", status: "finished", minute: "", link: "" },
    { id: "fb-2", league: "الدوري الإسباني", leagueKey: "esp.1", home: "ريال مدريد", away: "برشلونة", homeCode: "RMA", awayCode: "BAR", homeLogo: "", awayLogo: "", hs: "-", as: "-", time: "22:00", iso: "", status: "upcoming", minute: "", link: "" },
  ],
  tomorrow: [],
};

export const fallbackNews: NewsItem[] = [
  {
    slug: "n-fallback-1",
    title: "يالااكورة: تغطية عربية حية للمباريات والأخبار",
    excerpt: "تابع النتائج والمباريات والأخبار الرياضية مترجمة للعربية من مصادر عامة موثوقة.",
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=900&q=70",
    date: "اليوم", source: "يالااكورة", link: "",
    body: ["تابع كل المستجدات الرياضية عبر يالااكورة.", "نستخدم بيانات عامة من ESPN وترجمة آلية، ومصادر فيديو قانونية فقط."],
  },
];
