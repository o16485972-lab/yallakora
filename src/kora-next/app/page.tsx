import MatchCard from "@/components/MatchCard";
import { fallbackMatches, fallbackNews, getMatches, getNews, LEAGUES } from "@/lib/data";

export const revalidate = 300;

export default async function HomePage() {
  let matches = fallbackMatches;
  let news = fallbackNews;
  let live = false;
  try {
    const [m, n] = await Promise.all([getMatches(), getNews(12)]);
    if (m.today.length || m.tomorrow.length) { matches = m; live = true; }
    if (n.length) news = n;
  } catch {
    /* البيانات الاحتياطية تعمل دائماً */
  }

  const heroNews = news[0];
  const today = matches.today.slice(0, 6);
  const upcoming = matches.tomorrow.slice(0, 4);
  const latest = news.slice(0, 8);
  const liveCount = Object.values(matches).flat().filter((m) => m.status === "live").length;

  return (
    <div className="container">
      <section className="league-strip" aria-label="البطولات">
        {LEAGUES.map((l) => <span className="league-chip" key={l.key}><span>{l.icon}</span> {l.ar}</span>)}
      </section>

      <section className="section hero">
        <div className="hero-main">
          {heroNews?.image ? <img src={heroNews.image} alt="" /> : null}
          <div className="hero-content">
            <span className="hero-tag">{live ? "⚡ بيانات حية" : "⚽ يالااكورة"}</span>
            <h1>{heroNews?.title || "يالااكورة — كرة القدم بالعربية"}</h1>
            <p>{heroNews?.excerpt || "تابع المباريات والأخبار والنتائج في مكان واحد."}</p>
            <a className="btn light" href={heroNews ? `/news/${heroNews.slug}` : "/news"}>اقرأ الخبر كامل ←</a>
          </div>
        </div>
        <div className="hero-side">
          <div className="quick-cards">
            <div className="quick-card"><strong>{Object.values(matches).flat().length}</strong><span>مباراة متاحة</span></div>
            <div className="quick-card"><strong className={liveCount ? "green" : ""}>{liveCount}</strong><span>مباريات مباشرة</span></div>
            <div className="quick-card"><strong>{news.length}</strong><span>خبر مترجم</span></div>
          </div>
          <div className="card card-body">
            <div className="section-head" style={{ marginBottom: 10 }}><h2 style={{ fontSize: 17 }}>مباريات اليوم</h2><a href="/matches">عرض الكل</a></div>
            <div className="match-list">{today.length ? today.map((m) => <MatchCard key={m.id} match={m} />) : <p className="meta">لا توجد مباريات اليوم</p>}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>آخر الأخبار</h2><a href="/news">كل الأخبار ←</a></div>
        <div className="grid grid-4">
          {latest.map((item) => (
            <a className="news-card" href={`/news/${item.slug}`} key={item.slug}>
              {item.image ? <img src={item.image} alt="" loading="lazy" /> : null}
              <div className="card-body">
                <span className="tag">{item.source}</span>
                <h3>{item.title}</h3>
                <p>{item.excerpt}</p>
                <span className="meta">{item.date} · اقرأ المزيد ←</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {upcoming.length ? (
        <section className="section">
          <div className="section-head"><h2>غداً</h2><a href="/matches#tomorrow">المزيد ←</a></div>
          <div className="grid grid-2">
            {upcoming.map((m) => <MatchCard key={m.id} match={m} />)}
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="notice">
          🎥 الفيديو المتاح قانونياً فقط عبر قنوات البث الرسمية على YouTube (تضمين youtube-nocookie).
          لا نوفّر روابط بث مباشر غير مرخّصة. <a href="/sources" style={{ color: "inherit", fontWeight: 800 }}>شاهد المصادر ←</a>
        </div>
      </section>
    </div>
  );
}
