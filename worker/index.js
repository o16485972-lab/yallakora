/* ============================================================
   yallaakora - Cloudflare Worker (مجاني بدون بطاقة بنكية)
   ------------------------------------------------------------
   /register  تسجيل اشتراك Web Push (بدون Firebase)
   /feed      الرسائل الجديدة للـ Service Worker
   /push      إرسال يدوي (محمي بـ x-kora-secret اختياري)
   /aiBrief   ملخص عربي (OpenAI اختياري + fallback محلي)
   scheduled  تنبيه بدء المباريات من ESPN كل 5 دقائق
   ============================================================ */
"use strict";

const LEAGUES = ["eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "usa.1"];
const MAX_FEED = 50;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "Content-Type, x-kora-secret",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "cache-control": "no-store"
  }
});

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function privateKeyFromPem(pem) {
  const clean = String(pem || "").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(clean);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer;
}

async function pushHeaders(endpoint, env) {
  const key = await crypto.subtle.importKey(
    "pkcs8", privateKeyFromPem(env.VAPID_PRIVATE_KEY),
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
  const payload = b64url(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: "mailto:admin@yallakora.mooo.com"
  })));
  const unsigned = head + "." + payload;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned));
  return {
    "Authorization": "WebPush " + unsigned + "." + b64url(sig),
    "Crypto-Key": "p256ecdsa=" + env.VAPID_PUBLIC_KEY,
    "TTL": "300",
    "Urgency": "high"
  };
}

async function listSubs(env) {
  const ids = await env.KORA_KV.get("subs", "json") || [];
  const out = await Promise.all(ids.map((id) => env.KORA_KV.get("sub:" + id, "json")));
  return out.filter(Boolean);
}

async function pushAll(env) {
  const subs = await listSubs(env);
  let ok = 0, fail = 0;
  for (const s of subs) {
    try {
      const r = await fetch(s.endpoint, {
        method: "POST", headers: await pushHeaders(s.endpoint, env), body: null
      });
      if ([201, 202, 204].includes(r.status)) ok++; else fail++;
    } catch (_) { fail++; }
  }
  return { ok, fail };
}

async function enqueue(env, message) {
  const feed = await env.KORA_KV.get("feed", "json") || [];
  feed.unshift({ id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 7), time: Date.now(), ...message });
  await env.KORA_KV.put("feed", JSON.stringify(feed.slice(0, MAX_FEED)));
}

async function ar(text) {
  try {
    const r = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=" + encodeURIComponent(String(text || "")));
    const j = await r.json();
    return (j[0] || []).map((x) => x[0]).join("") || text;
  } catch (_) { return text; }
}

async function nearKickoffs(env) {
  const now = Date.now();
  const dates = [new Date(now), new Date(now + 86400000)]
    .map((d) => d.toISOString().slice(0, 10).replace(/-/g, ""));
  const out = [];
  for (const league of LEAGUES) {
    for (const date of dates) {
      try {
        const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${date}`);
        const j = await r.json();
        for (const ev of j.events || []) {
          const diff = Date.parse(ev.date) - now;
          if (diff < 4 * 60000 || diff > 16 * 60000) continue;
          const seen = await env.KORA_KV.get("sent:" + ev.id);
          if (seen) continue;
          await env.KORA_KV.put("sent:" + ev.id, "1", { expirationTtl: 86400 });
          const comp = (ev.competitions || [])[0] || {};
          const c = comp.competitors || [];
          const home = c.find((x) => x.homeAway === "home");
          const away = c.find((x) => x.homeAway === "away");
          if (!home || !away) continue;
          let kickTime = "";
          try {
            kickTime = new Date(ev.date).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" });
          } catch (_) { kickTime = new Date(ev.date).toISOString().slice(11, 16); }
          out.push({
            title: "⚽ مباراة تبدأ قريباً",
            body: (await ar(home.team.displayName || "")) + " × " + (await ar(away.team.displayName || "")) +
              " — " + kickTime + " بتوقيت القاهرة",
            url: "#/matches"
          });
        }
      } catch (err) { console.warn("ESPN", league, date, String(err)); }
    }
  }
  return out.slice(0, 10);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (request.method === "OPTIONS") return json({});

    try {
      if (path === "/register" && request.method === "POST") {
        const b = await request.json();
        const id = String(b.id || "").slice(0, 80);
        const endpoint = String(b.endpoint || "");
        if (!id || !/^https:\/\//.test(endpoint)) return json({ error: "invalid subscription" }, 400);
        const ids = await env.KORA_KV.get("subs", "json") || [];
        if (!ids.includes(id)) ids.push(id);
        await env.KORA_KV.put("subs", JSON.stringify(ids.slice(-2000)));
        await env.KORA_KV.put("sub:" + id, JSON.stringify({
          endpoint, city: String(b.city || "").slice(0, 40),
          favorites: Array.isArray(b.favorites) ? b.favorites.slice(0, 30).map(String) : [],
          createdAt: Date.now()
        }));
        return json({ ok: true, id });
      }

      if (path === "/feed") {
        const since = Number(url.searchParams.get("since") || 0) || 0;
        const feed = await env.KORA_KV.get("feed", "json") || [];
        return json({ items: feed.filter((m) => Number(m.time) > since), now: Date.now() });
      }

      if (path === "/push" && request.method === "POST") {
        if (env.KORA_SECRET && request.headers.get("x-kora-secret") !== env.KORA_SECRET) {
          return json({ error: "forbidden" }, 403);
        }
        const b = await request.json();
        if (!b.title || !b.body) return json({ error: "title and body required" }, 400);
        await enqueue(env, { title: String(b.title), body: String(b.body), url: String(b.url || "#/matches") });
        const sent = await pushAll(env);
        return json({ ok: true, ...sent });
      }

      if (path === "/aiBrief" && request.method === "POST") {
        const b = await request.json();
        const input = String(b.input || "");
        if (!input) return json({ error: "input required" }, 400);
        if (!env.OPENAI_API_KEY) {
          return json({ summary: "ملخص تلقائي: " + input.split("\n").filter(Boolean).slice(0, 2).join(" "), fallback: true });
        }
        try {
          const r = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_API_KEY },
            body: JSON.stringify({
              model: b.model || env.OPENAI_MODEL || "gpt-4o-mini",
              messages: [
                { role: "system", content: "أنت محرر رياضي عربي. لخّص البيانات التالية في فقرة عربية موجزة وحيادية دون اختراع معلومات." },
                { role: "user", content: input }
              ],
              max_tokens: 220
            })
          });
          const j = await r.json();
          const summary = j.choices?.[0]?.message?.content;
          if (!summary) throw new Error(j.error?.message || "no summary");
          return json({ summary, fallback: false });
        } catch (err) {
          return json({ summary: "ملخص تلقائي: " + input.split("\n").filter(Boolean).slice(0, 2).join(" "), fallback: true });
        }
      }

      return json({ error: "not found", routes: ["/register", "/feed", "/push", "/aiBrief"] }, 404);
    } catch (err) {
      return json({ error: String(err && err.message || err) }, 500);
    }
  },

  async scheduled(controller, env) {
    const matches = await nearKickoffs(env);
    if (!matches.length) return;
    for (const m of matches) await enqueue(env, m);
    await pushAll(env);
  }
};
