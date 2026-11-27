import type { Metadata } from "next";
import { fallbackNews, getNews } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = { title: "الأخبار الرياضية", description: "أخبار كرة القدم مترجمة للعربية من مصادر عامة." };

export default async function NewsPage() {
  let news = fallbackNews;
  try { const n = await getNews(24); if (n.length) news = n; } catch { /* fallback */ }
  const [featured, ...rest] = news;

  return (
    <div className="container">
      <div className="section-head"><h1 style={{ fontSize: 26 }}>الأخبار الرياضية</h1><span className="meta">{news.length} خبر مترجم للعربية</span></div>
      {featured ? (
        <a className="featured-news" href={`/news/${featured.slug}`}>
          {featured.image ? <img src={featured.image} alt="" /> : null}
          <div>
            <span className="tag">الأحدث</span>
            <h2>{featured.title}</h2>
            <p>{featured.excerpt}</p>
            <span className="meta">{featured.date} · {featured.source}</span>
          </div>
        </a>
      ) : null}
      <div className="section" style={{ marginTop: 24 }}>
        <div className="section-head"><h2>كل الأخبار</h2></div>
        <div className="grid grid-3">
          {rest.map((item) => (
            <a className="news-card" href={`/news/${item.slug}`} key={item.slug}>
              {item.image ? <img src={item.image} alt="" loading="lazy" /> : null}
              <div className="card-body">
                <span className="tag">{item.source}</span>
                <h3>{item.title}</h3>
                <p>{item.excerpt}</p>
                <span className="meta">{item.date}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
