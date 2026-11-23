# yallaakora Backend (Firebase Cloud Functions)

هذا المجلد يحتوي علىBackend جاهز للنشر. لا يحتاج أي تعديل ليُ نشر، ويعمل بأقل إعداد منك.

## الدوال

| الدالة | الوظيفة |
|---|---|
| `registerToken` | تستقبل رمز جهاز FCM من الموقع وتحفظه في Firestore (`kora_tokens`) |
| `sendPush` | إرسال يدوي لجهاز أو topic — محمي بـ `x-kora-secret` عند ضبطه |
| `kickoffCron` | كل 5 دقائق: تقرأ جدول ESPN وترسل تنبيه قبل بدء المباريات |
| `aiBrief` | ملخص عربي عبر OpenAI، أو ملخص محلي إذا لم يضف مفتاح |

## النشر (خطواتك أنت — حوالي 10 دقائق)

1. ثبّت [Firebase CLI](https://firebase.google.com/docs/cli) وسجّل الدخول:
   ```bash
   npm i -g firebase-tools
   firebase login
   ```
2. في مجلد المشروع أنشئ `firebase.json` (أو استخدم `firebase init functions`):
   ```json
   { "functions": { "source": "functions", "runtime": "nodejs20" }, "hosting": { "public": ".", "ignore": ["functions/**", "node_modules/**"] } }
   ```
3. فعّل **Cloud Messaging** وأنشئ قاعدة **Firestore** من Firebase Console.
4. انسخ `functions/.env.example` إلى `functions/.env` وضع `OPENAI_API_KEY` إن توفر، ثم:
   ```bash
   firebase functions:secrets:set OPENAI_API_KEY
   ```
   (الأفضل للأمان: secrets بدل `.env`).
5. انشر الدوال:
   ```bash
   firebase deploy --only functions
   ```
6. في `js/config.js` ضع بيانات Firebase، واضبط `functionsUrl` على رابط الدوال:
   `https://europe-west1-<PROJECT_ID>.cloudfunctions.net`

## ربط الموقع تلقائياً

بعد أن تضع `functionsUrl` في `js/config.js` (أو من لوحة التحكم `#/admin`)، فإن الموقع عند تفعيل FCM يرسل رمز الجهاز تلقائياً إلى `registerToken`، ويصبح مستعداً لاستقبال تنبيهات `kickoffCron` حتى وهو مغلق.

## إرسال تجريبي يدوي

```bash
curl -X POST https://europe-west1-PROJECT_ID.cloudfunctions.net/sendPush \
  -H "Content-Type: application/json" \
  -H "x-kora-secret: YOUR_SECRET" \
  -d '{"token":"FCM_DEVICE_TOKEN","title":"yallaakora ⚽","body":"اختبار","url":"#/matches"}'
```

> ملاحظة: `kickoffCron` يرسل للمستخدمين المسجّلين فقط، ويمنع التكرار عبر Firestore. يستخدم واجهة ESPN العامة وترجمة Google العامة مثل باقي الموقع.
