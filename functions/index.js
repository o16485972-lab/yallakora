/* ============================================================
   yallaakora - Firebase Cloud Functions (Backend جاهز للنشر)
   ------------------------------------------------------------
   registerToken : يستقبل رمز جهاز FCM من الموقع ويحفظه في Firestore
   sendPush      : إرسال يدوي (محمي بـ KORA_PUSH_SECRET)
   kickoffCron   : كل 5 دقائق يراقب ESPN ويرسل تنبيه قبل المباريات
   aiBrief       : ملخص عربي عبر OpenAI، أو ملخص محلي إذا لم يوجد مفتاح
   ============================================================ */
"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const LEAGUES = ["eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "usa.1"];
const db = () => admin.firestore();
const msg = () => admin.messaging();

function cors(req, res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, x-kora-secret");
  res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return false; }
  return true;
}

function authorized(req, res) {
  const secret = process.env.KORA_PUSH_SECRET || "";
  if (!secret) return true; // لا يوجد سر مضبوط = مفتوح (للاستخدام الشخصي فقط)
  if (req.get("x-kora-secret") === secret) return true;
  res.status(403).json({ error: "forbidden" });
  return false;
}

async function ar(text) {
  try {
    const q = encodeURIComponent(String(text || ""));
    const r = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=" + q);
    const j = await r.json();
    return (j[0] || []).map((x) => x[0]).join("") || text;
  } catch (_) { return text; }
}

/* ------------------------------------------------------------
   1) تسجيل رمز الجهاز — يستدعيه الموقع تلقائياً بعد تفعيل FCM
   ------------------------------------------------------------ */
exports.registerToken = onRequest(async (req, res) => {
  if (!cors(req, res)) return;
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  try {
    const token = String((req.body && req.body.token) || "");
    if (!token || token.length < 20) { res.status(400).json({ error: "invalid token" }); return; }
    await db().collection("kora_tokens").doc(token).set({
      token,
      city: (req.body.city || "").slice(0, 40),
      favorites: Array.isArray(req.body.favorites) ? req.body.favorites.slice(0, 30).map(String) : [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    res.json({ ok: true });
  } catch (err) {
    console.error("registerToken", err);
    res.status(500).json({ error: "server error" });
  }
});

/* ------------------------------------------------------------
   2) إرسال يدوي: { token | topic, title, body, url }
   ------------------------------------------------------------ */
exports.sendPush = onRequest(async (req, res) => {
  if (!cors(req, res) || !authorized(req, res)) return;
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  try {
    const b = req.body || {};
    const notification = { title: String(b.title || "yallaakora ⚽"), body: String(b.body || "") };
    const data = { url: String(b.url || "#/matches") };
    const webpush = { notification: { icon: "https://yallakora.mooo.com/icon.svg", badge: "https://yallakora.mooo.com/icon.svg" } };
    const payload = b.token
      ? { token: String(b.token), notification, data, webpush }
      : { topic: String(b.topic || "matches"), notification, data, webpush };
    const result = await msg().send(payload);
    res.json({ ok: true, messageId: result });
  } catch (err) {
    console.error("sendPush", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

/* ------------------------------------------------------------
   3) تنبيه بدء المباريات — يعمل بدون تدخل، كل 5 دقائق
   ------------------------------------------------------------ */
const sentMemory = new Set();
async function wasSent(id) {
  if (sentMemory.has(id)) return true;
  sentMemory.add(id);
  try { await db().collection("kora_sent").doc(id).create({ at: admin.firestore.FieldValue.serverTimestamp() }); }
  catch (_) { /* Firestore غير مفعّل → يكفي الكاش المحلي */ }
  return false;
}

async function nearKickoffs() {
  const now = Date.now();
  const out = [];
  const dates = [new Date(now), new Date(now + 24 * 3600 * 1000)]
    .map((d) => d.toISOString().slice(0, 10).replace(/-/g, ""));
  for (const league of LEAGUES) {
    for (const date of dates) {
      try {
        const r = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/" + league + "/scoreboard?dates=" + date);
        const j = await r.json();
        for (const ev of j.events || []) {
          const diff = Date.parse(ev.date) - now;
          if (diff < 4 * 60000 || diff > 16 * 60000) continue;
          if (await wasSent(String(ev.id))) continue;
          const comp = (ev.competitions || [])[0] || {};
          const home = (comp.competitors || []).find((c) => c.homeAway === "home");
          const away = (comp.competitors || []).find((c) => c.homeAway === "away");
          if (!home || !away) continue;
          out.push({
            id: String(ev.id),
            home: await ar(home.team.displayName || home.team.shortDisplayName),
            away: await ar(away.team.displayName || away.team.shortDisplayName),
            time: new Date(ev.date).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" })
          });
        }
      } catch (err) { console.warn("ESPN", league, date, String(err.message || err)); }
    }
  }
  return out.slice(0, 20);
}

exports.kickoffCron = onSchedule("every 5 minutes", async () => {
  const matches = await nearKickoffs();
  if (!matches.length) return;
  let tokens = [];
  try {
    const snap = await db().collection("kora_tokens").limit(500).get();
    tokens = snap.docs.map((d) => d.data().token).filter(Boolean);
  } catch (_) { /* لا يوجد Firestore → لا مستلمين */ }
  if (!tokens.length) return;
  const messages = [];
  for (const m of matches) {
    for (const token of tokens) {
      messages.push({
        token,
        notification: { title: "⚽ مباراة تبدأ قريباً", body: m.home + " × " + m.away + " — " + m.time + " بتوقيت القاهرة" },
        data: { url: "#/matches", eventId: m.id },
        webpush: { notification: { icon: "https://yallakora.mooo.com/icon.svg" } }
      });
    }
  }
  for (let i = 0; i < messages.length; i += 500) {
    try { await msg().sendEach(messages.slice(i, i + 500)); }
    catch (err) { console.error("sendEach", err); }
  }
});

/* ------------------------------------------------------------
   4) ملخص AI عربي — يعمل محلياً fallback عند غياب المفتاح
   ------------------------------------------------------------ */
exports.aiBrief = onRequest(async (req, res) => {
  if (!cors(req, res) || !authorized(req, res)) return;
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const input = String((req.body && req.body.input) || "");
  if (!input) { res.status(400).json({ error: "input required" }); return; }
  const key = process.env.OPENAI_API_KEY || "";
  if (!key) {
    res.json({ summary: "ملخص تلقائي: " + input.split("\n").filter(Boolean).slice(0, 2).join(" "), fallback: true });
    return;
  }
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({
        model: (req.body && req.body.model) || process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: "أنت محرر رياضي عربي. لخّص البيانات التالية في فقرة عربية موجزة وحيادية دون اختراع معلومات." },
          { role: "user", content: input }
        ],
        max_tokens: 220
      })
    });
    const j = await r.json();
    const summary = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!summary) throw new Error(j.error?.message || "no summary");
    res.json({ summary, fallback: false });
  } catch (err) {
    console.error("aiBrief", err);
    res.json({ summary: "ملخص تلقائي: " + input.split("\n").filter(Boolean).slice(0, 2).join(" "), fallback: true });
  }
});
