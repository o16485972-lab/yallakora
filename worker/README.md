# yallaakora Push Worker (Cloudflare — مجاني 100%)

بديل كامل عن Firebase Cloud Functions **بدون بطاقة بنكية**. يوفّر:

- `/register` — تسجيل اشتراك Web Push الخاص بالمتصفح.
- `/feed` — يقرأه Service Worker لعرض الإشعارات الواردة.
- `/push` — إرسال يدوي (محمي بـ `x-kora-secret` عند ضبطه).
- `/aiBrief` — ملخص عربي (OpenAI اختياري، والملخص المحلي مجاني).
- `scheduled` — كل 5 دقائق يفحص ESPN ويرسل تنبيه قبل بدء المباريات.

## الحدود المجانية (خطة Workers المجانية)

100 ألف طلب/يوم، KV: 100 ألف قراءة/يوم و1 ألف كتابة/يوم و1 جيجابايت، Cron Triggers مجاني. استهلاك موقعك أقل بكثير من ذلك.

## خطوات النشر (منك — 10 دقائق، بدون دفع)

1. أنشئ حساباً مجانياً على [Cloudflare](https://dash.cloudflare.com/sign-up).
2. ثبّت Node.js ثم:
   ```bash
   npm i -g wrangler
   wrangler login
   ```
3. من داخل مجلد `worker`:
   ```bash
   wrangler kv namespace create KORA_KV
   ```
   انسخ الـ `id` الناتج وضعه مكان `REPLACE_WITH_KV_NAMESPACE_ID` في `wrangler.toml`.
4. اضبط المفتاح الخاص (موجود في ملف `vapid-keys.txt` الذي جهّزته لك، أو ولّد جديداً):
   ```bash
   wrangler secret put VAPID_PRIVATE_KEY
   ```
   الصق محتوى `VAPID_PRIVATE_KEY_PEM` كاملاً مع سطري `BEGIN/END`.
5. اختياري:
   ```bash
   wrangler secret put KORA_SECRET      # لحماية /push و /aiBrief
   wrangler secret put OPENAI_API_KEY   # للملخص المدفوع؛ بدونه يعمل المحلي
   ```
6. انشر:
   ```bash
   wrangler deploy
   ```
   ستحصل على رابط مثل `https://yallakora-push.<حسابك>.workers.dev`.
7. افتح `#/admin` في الموقع، ضع الرابط في حقل **Cloudflare Worker URL**، واحفظ. المفتاح العام مضبوط مسبقاً في `js/config.js`.

## ملاحظات

- الإشعارات تُرسل **بدون حمولة مشفّرة**؛ الـ Service Worker يجلب النص من `/feed` عند وصول إشعار فارغ، وهذا مدعوم في كل المتصفحات ويغني عن تشفير Web Push المعقّد.
- أول دقيقة بعد التفعيل يُطلب إذن الإشعارات؛ اضغط «تفعيل الإشعارات» في `#/settings` إذا لم يظهر الطلب تلقائياً.
- لتجنّب CORS تماماً يمكنك عمل Route على نفس النطاق: `yallakora.mooo.com/api/*` → Worker، ثم تضع `/api` كرابط في الإعدادات.
