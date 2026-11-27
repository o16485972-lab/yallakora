/* ============================================================
   yallaakora - المصادر الرسمية والقانونية للفيديو والبيانات
   ------------------------------------------------------------
   كل رابط هنا تم التحقق منه (HTTP 200 + اسم القناة الرسمية عبر
   YouTube oEmbed أو وثائق المصدر). الفيديو يُعرض بتضمين يوتيوب
   الرسمي فقط، ولا يتم تنزيله أو إعادة بثه داخل الموقع.
   ============================================================ */
(function () {
  "use strict";

  /* فيديوهات مسموح تضمينها: القناة الرسمية صاحبة الحقوق رفعتها بنفسها.
     تُستخدم في مشغّل يوتيوب داخل الموقع (youtube-nocookie embed). */
  window.KORA_OFFICIAL_VIDEOS = [
    {
      id: "G3zxz-ewBxc",
      title: "كامل المباراة | هولندا × اليابان | كأس العالم 2026",
      source: "FIFA",
      sourceUrl: "https://www.youtube.com/@fifa",
      kind: "مباراة كاملة",
      thumb: "https://i.ytimg.com/vi/G3zxz-ewBxc/hqdefault.jpg"
    },
    {
      id: "S_qyv_MTy90",
      title: "كامل المباراة | البرتغال × أوزبكستان | كأس العالم 2026",
      source: "FIFA",
      sourceUrl: "https://www.youtube.com/@fifa",
      kind: "مباراة كاملة",
      thumb: "https://i.ytimg.com/vi/S_qyv_MTy90/hqdefault.jpg"
    },
    {
      id: "ybjeFdCWt0Y",
      title: "كامل المباراة | كندا × قطر | كأس العالم 2026",
      source: "FIFA",
      sourceUrl: "https://www.youtube.com/@fifa",
      kind: "مباراة كاملة",
      thumb: "https://i.ytimg.com/vi/ybjeFdCWt0Y/hqdefault.jpg"
    },
    {
      id: "DIBmIVAdlO0",
      title: "كامل المباراة | أمريكا × باراغواي | كأس العالم 2026",
      source: "FIFA",
      sourceUrl: "https://www.youtube.com/@fifa",
      kind: "مباراة كاملة",
      thumb: "https://i.ytimg.com/vi/DIBmIVAdlO0/hqdefault.jpg"
    },
    {
      id: "6HaHNYjnghE",
      title: "ملخص | إسبانيا 1-0 الأرجنتين | نهائي كأس العالم 2026",
      source: "FIFA",
      sourceUrl: "https://www.youtube.com/@fifa",
      kind: "ملخص",
      thumb: "https://i.ytimg.com/vi/6HaHNYjnghE/hqdefault.jpg"
    },
    {
      id: "chuhAI45g70",
      title: "ملخص نهائي أمم أفريقيا 2025 | السنغال × المغرب",
      source: "CAF TV",
      sourceUrl: "https://www.youtube.com/@CAF_TV",
      kind: "ملخص",
      thumb: "https://i.ytimg.com/vi/chuhAI45g70/hqdefault.jpg"
    },
    {
      id: "4AJmJR_4fGI",
      title: "أهداف كلاسيكية | مانشستر يونايتد × روما",
      source: "UEFA",
      sourceUrl: "https://www.youtube.com/@UEFA",
      kind: "ملخص",
      thumb: "https://i.ytimg.com/vi/4AJmJR_4fGI/hqdefault.jpg"
    }
  ];

  /* دليل الناقلين الرسميين في الشرق الأوسط وشمال أفريقيا.
     الحقوق مقسّمة حسب البطولة + الدولة + الموسم + باقة الاشتراك،
     وهذا دليل إرشادي والمرجع النهائي هو إعلان الناقل نفسه. */
  window.KORA_BROADCASTERS = [
    {
      name: "beIN Sports",
      region: "الشرق الأوسط وشمال أفريقيا",
      comps: [
        "كأس العالم 2026 — حصرياً في المنطقة عبر beIN SPORTS MAX HD1 / MAX 3",
        "دوري أبطال أوروبا والدوري الأوروبي ودوري المؤتمرات",
        "الدوري الإنجليزي الممتاز",
        "الدوري الإسباني",
        "الدوري الفرنسي",
        "الدوري الألماني"
      ],
      platforms: [
        { label: "beIN Sports الرسمي", url: "https://www.beinsports.com/ar-mena" },
        { label: "TOD · البث الرقمي", url: "https://www.tod.tv/ar" }
      ],
      note: "المشاهدة الكاملة تتم عبر اشتراك beIN CONNECT / TOD أو الباقة الفضائية. الموقع وسيط إخباري فقط ولا يعيد البث."
    },
    {
      name: "SSC · ثمانية",
      region: "السعودية",
      comps: [
        "دوري روشن السعودي للمحترفين",
        "كأس خادم الحرمين الشريفين",
        "البطولات السعودية المحلية"
      ],
      platforms: [
        { label: "ثمانية · thmanyah", url: "https://thmanyah.com" },
        { label: "شاهد · قنوات SSC", url: "https://shahid.mbc.net" }
      ],
      note: "قنوات SSC الرياضية السعودية، والبث الرقمي عبر منصات ثمانية وشاهد بحسب الاتفاق المعلن لكل موسم."
    },
    {
      name: "أبوظبي الرياضية · STARZPLAY",
      region: "الإمارات",
      comps: [
        "دوري أدنوك للمحترفين الإماراتي",
        "كأس رئيس الدولة",
        "البطولات الإماراتية المحلية"
      ],
      platforms: [
        { label: "أبوظبي الرياضية / STARZPLAY", url: "https://starzplay.com/ar/admn" }
      ],
      note: "القنوات الرياضية الإماراتية ومنصتها الرقمية الرسمية."
    },
    {
      name: "الرياضية المغربية · Arryadia",
      region: "المغرب",
      comps: [
        "الدوري المغربي الاحترافي",
        "كأس العرش",
        "بعض بطولات الأندية الأفريقية بحسب الاتفاق"
      ],
      platforms: [
        { label: "SNRT · الشركة الوطنية للإذاعة والتلفزة", url: "https://www.snrt.ma/" }
      ],
      note: "القناة الرياضية المغربية الرسمية التابعة لـ SNRT."
    },
    {
      name: "ON Sport",
      region: "مصر",
      comps: [
        "الدوري المصري الممتاز",
        "كأس مصر",
        "بعض مباريات الأندية المصرية والمنتخب بحسب الاتفاق"
      ],
      platforms: [
        { label: "ON TV الرسمي", url: "https://www.ontveg.com/" }
      ],
      note: "الناقل المحلي الأبرز للكرة المصرية. حقوق المنتخب والبطولات الأفريقية قد تختلف حسب الموسم."
    }
  ];

  /* مصادر رسمية: إما تمنح ترخيصاً حراً/مجانياً صريحاً، أو تسمح
     بالتضمين/العرض ضمن شروطها المعلنة. لا نضع هنا أي مصدر «بث مجاني»
     غير موثّق الحقوق. */
  window.KORA_SOURCES = [
    {
      name: "FIFA · القناة الرسمية",
      tag: "فيديو رسمي مجاني",
      url: "https://www.youtube.com/@fifa",
      desc: "قناة فيفا الرسمية تنشر مباريات كأس العالم 2026 كاملة وملخصاتها مجاناً. الصفحة الرسمية تقول إن أرشيف المباريات متاح للمشاهدة وللمبدعين لإعادة استخدامه.",
      extra: "قائمة المباريات الكاملة",
      extraUrl: "https://www.youtube.com/playlist?list=PLPkm2ti42OTc"
    },
    {
      name: "UEFA · القناة الرسمية",
      tag: "فيديو رسمي",
      url: "https://www.youtube.com/@UEFA",
      desc: "القناة الرسمية للاتحاد الأوروبي: ملخصات وأهداف دوري الأبطال واليوروبا. التضمين عبر مشغّل يوتيوب الرسمي مسموح به.",
      extra: "UEFA.tv",
      extraUrl: "https://www.uefa.tv/"
    },
    {
      name: "CAF TV · القناة الرسمية",
      tag: "فيديو رسمي",
      url: "https://www.youtube.com/@CAF_TV",
      desc: "قناة الكونفدرالية الأفريقية الرسمية: ملخصات وبث مباشر لبطولات أفريقيا، منها كأس أمم أفريقيا ودوري الأبطال.",
      extra: "",
      extraUrl: ""
    },
    {
      name: "TheSportsDB Free API",
      tag: "بيانات مجانية · CC",
      url: "https://www.thesportsdb.com/docs_api_guide",
      desc: "واجهة رسمية مجانية بالمفتاح العام 123، تدعم CORS وتسمح بقراءة/نسخ/تعديل بيانات الـ API الرسمية مع نسبة المصدر واحترام حقوق الغير. الموقع يستخدمها للشعارات والتشكيلات وقنوات البث الرسمية.",
      extra: "شروط الاستخدام",
      extraUrl: "https://www.thesportsdb.com/docs_terms_of_use.php"
    },
    {
      name: "Open-Meteo",
      tag: "CC BY 4.0",
      url: "https://open-meteo.com/",
      desc: "بيانات طقس مفتوحة برخصة CC BY 4.0، مجانية للاستخدام غير التجاري بدون مفتاح. الموقع يعرض درجة حرارة المباراة ويذكر المصدر بجانبها.",
      extra: "الرخصة",
      extraUrl: "https://open-meteo.com/en/licence"
    },
    {
      name: "Highlightly Football API",
      tag: "خطة مجانية · تضمين",
      url: "https://highlightly.net/football-api/documentation/highlights",
      desc: "واجهة فيديو رسمية تميّز مقاطع VERIFIED (صاحب الحقوق هو الناشر غالباً) وتوفر embedUrl وحقل embeddable وفاحص قيود جغرافية. الخطة المجانية تسمح بـ 100 طلب يومياً وتحتاج تسجيل مفتاح مجاني.",
      extra: "التوثيق",
      extraUrl: "https://highlightly.net/football-api/documentation/highlights"
    },
    {
      name: "Scorebat Video API",
      tag: "خطة مجانية بمفتاح",
      url: "https://www.scorebat.com/video-api/docs",
      desc: "واجهة فيديو كرة رسمية؛ الخطة المجانية تعمل مع free-feed لكنها تتطلب تسجيل حساب Developer والحصول على توكن. بدون التوكن يرجع 403، لذلك لم يُربط مباشرة في الموقع.",
      extra: "التوثيق",
      extraUrl: "https://www.scorebat.com/video-api/docs"
    },
    {
      name: "Wikimedia Commons",
      tag: "ترخيص حر / CC",
      url: "https://commons.wikimedia.org/wiki/Category:Videos_of_association_football",
      desc: "أرشيف وسائط حرة يشمل مقاطع كرة قدم تحت رخص CC أو ملكية عامة. كل ملف له رخصته الخاصة ويجب ذكر المصدر حسب صفحة الملف.",
      extra: "",
      extraUrl: ""
    },
    {
      name: "YouTube Embed API",
      tag: "آلية تضمين قانونية",
      url: "https://developers.google.com/youtube/player_parameters",
      desc: "الطريقة الرسمية لتضمين فيديو يوتيوب داخل أي موقع عبر iframe. الموقع يستخدمها مع وضع الخصوصية youtube-nocookie دون تنزيل الفيديو أو إخفاء بياناته.",
      extra: "سياسات المطوّرين",
      extraUrl: "https://developers.google.com/youtube/terms/developer-policies"
    }
  ];
})();
