import type { Metadata } from "next";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "المصادر الرسمية والفيديو القانوني",
  description: "قنوات رسمية ومصادر بيانات قانونية للفيديو والمباريات في يالااكورة.",
};

const VIDEOS = [
  { id: "G3zxz-ewBxc", title: "هولندا × اليابان — كأس العالم 2026", source: "FIFA" },
  { id: "S_qyv_MTy90", title: "البرتغال × أوزبكستان — كأس العالم 2026", source: "FIFA" },
  { id: "ybjeFdCWt0Y", title: "كندا × قطر — كأس العالم 2026", source: "FIFA" },
  { id: "DIBmIVAdlO0", title: "أمريكا × باراغواي — كأس العالم 2026", source: "FIFA" },
  { id: "6HaHNYjnghE", title: "ملخص نهائي كأس العالم 2026", source: "FIFA" },
  { id: "chuhAI45g70", title: "ملخص نهائي أمم أفريقيا 2025", source: "CAF TV" },
  { id: "4AJmJR_4fGI", title: "أهداف كلاسيكية | مانشستر يونايتد × روما", source: "UEFA" },
];

const BROADCASTERS = [
  { name: "beIN Sports", region: "الشرق الأوسط وشمال أفريقيا", url: "https://www.beinsports.com/ar-mena", note: "كأس العالم، دوري الأبطال، الدوريات الأوروبية — باشتراك رسمي." },
  { name: "SSC · ثمانية", region: "السعودية", url: "https://thmanyah.com", note: "دوري روشن والبطولات السعودية." },
  { name: "أبوظبي الرياضية", region: "الإمارات", url: "https://starzplay.com/ar/admn", note: "دوري أدنوك والبطولات الإماراتية." },
  { name: "ON Sport", region: "مصر", url: "https://www.ontveg.com/", note: "الدوري المصري وكأس مصر." },
  { name: "Arryadia", region: "المغرب", url: "https://www.snrt.ma/", note: "الدوري المغربي وكأس العرش." },
];

export default function SourcesPage() {
  return (
    <div className="container">
      <div className="section-head"><h1 style={{ fontSize: 26 }}>المصادر الرسمية والفيديو القانوني</h1></div>
      <div className="notice">
        نعرض فقط فيديو رفعته القناة صاحبة الحقوق بنفسها عبر مشغّل يوتيوب الرسمي (youtube-nocookie).
        لا ننزّل الفيديو ولا نعيد بثه، ولا نوفّر روابط بث مباشر غير مرخّصة.
      </div>

      <section className="section">
        <div className="section-head"><h2>فيديو رسمي قابل للتضمين</h2></div>
        <div className="grid grid-4">
          {VIDEOS.map((v) => (
            <div className="card video-card" key={v.id}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${v.id}`}
                title={v.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              <div className="card-body">
                <span className="tag">{v.source}</span>
                <h3 style={{ marginTop: 6 }}>{v.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>الناقلون الرسميون</h2></div>
        <div className="grid grid-3">
          {BROADCASTERS.map((b) => (
            <div className="card card-body" key={b.name}>
              <h3>{b.name}</h3>
              <div className="meta" style={{ margin: "4px 0 8px" }}>{b.region}</div>
              <p style={{ margin: "0 0 10px", color: "var(--ink-2)" }}>{b.note}</p>
              <a className="btn" href={b.url} target="_blank" rel="noopener noreferrer">الموقع الرسمي ↗</a>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>مصادر البيانات</h2></div>
        <div className="card card-body">
          <ul style={{ display: "grid", gap: 8 }}>
            <li>📊 <a href="https://www.espn.com/" target="_blank" rel="noopener noreferrer">ESPN</a> — نتائج ومباريات وأخبار عبر واجهاتها العامة.</li>
            <li>🌐 <a href="https://translate.google.com/" target="_blank" rel="noopener noreferrer">Google Translate</a> — ترجمة المحتوى للعربية.</li>
            <li>🗂️ <a href="https://www.thesportsdb.com/docs_api_guide" target="_blank" rel="noopener noreferrer">TheSportsDB</a> — شعارات وتشكيلات بمفتاح تجريبي عام 123.</li>
            <li>🌤️ <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> — طقس المباريات برخصة CC BY 4.0 (استخدام غير تجاري).</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
