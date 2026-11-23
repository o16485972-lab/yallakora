/* ============================================================
   yallaakora - الإعدادات العامة (قابلة للتعديل دون لمس الكود)
   ------------------------------------------------------------
   المفاتيح الفارغة تعني أن الميزة غير مفعّلة حالياً.
   عند الحصول على بياناتك الخاصة (Firebase / AdSense / AI)
   ضعها هنا وسيقوم الموقع بتفعيلها تلقائياً.
   ============================================================ */
(function () {
  "use strict";

  window.KORA_CONFIG = {
    /* الرابط الرسمي للموقع — يُستخدم في canonical و Open Graph */
    siteUrl: "https://yallakora.mooo.com",

    /* المدن والمناطق الزمنية لتحويل توقيت المباريات تلقائياً */
    cities: [
      { key: "cairo", label: "القاهرة", tz: "Africa/Cairo" },
      { key: "riyadh", label: "الرياض", tz: "Asia/Riyadh" },
      { key: "dubai", label: "دبي", tz: "Asia/Dubai" },
      { key: "casablanca", label: "الدار البيضاء", tz: "Africa/Casablanca" },
      { key: "algiers", label: "الجزائر", tz: "Africa/Algiers" },
      { key: "tunis", label: "تونس", tz: "Africa/Tunis" },
      { key: "beirut", label: "بيروت", tz: "Asia/Beirut" },
      { key: "amman", label: "عمّان", tz: "Asia/Amman" }
    ],
    defaultCity: "cairo",

    /* إشعارات المتصفح تعمل بدون سيرفر طالما الصفحة مفتوحة.
       إشعارات FCM الحقيقية (حتى مع إغلاق المتصفح) تحتاج بياناتك: */
    notifications: { minutesBefore: 15 },
    /* خطوات التفعيل:
       1) أنشئ مشروع Firebase وفعّل Cloud Messaging.
       2) Firebase Console > Project settings > Your apps > Web app → apiKey / appId / messagingSenderId.
       3) Cloud Messaging > Web configuration > Generate key pair → vapidKey.
       4) الصق القيم هنا. يتولّى الموقع تسجيل الـ Service Worker وطلب الإذن وجلب رمز الجهاز تلقائياً.
       ملاحظة: إرسال الإشعارات فعلياً يحتاج خادم/دالة سحابية ترسل عبر FCM باستخدام رمز الخادم (Server Key). */
    firebase: { apiKey: "", messagingSenderId: "", appId: "", vapidKey: "" },

    /* الإعلانات والرعاة — كلها معطّلة افتراضياً حتى تُضيف بياناتك */
    ads: {
      enabled: false,
      adsenseClient: "",
      adsenseSlot: "",
      sponsors: []
      /* مثال راعٍ: { name:"شريك الموقع", url:"https://...", logo:"https://..." } */
    },

    /* ملخص ذكي اختياري عبر واجهة خارجية؛ فارغ = الملخص المحلي المبني على البيانات */
    ai: { endpoint: "", model: "" }
  };
})();
