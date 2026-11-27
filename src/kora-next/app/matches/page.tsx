import type { Metadata } from "next";
import MatchCard from "@/components/MatchCard";
import { fallbackMatches, getMatches, type MatchDay } from "@/lib/data";

export const revalidate = 60;
export const metadata: Metadata = { title: "المباريات والنتائج", description: "مباريات ونتائج كرة القدم بالعربية من ESPN." };

const DAYS: Array<{ key: MatchDay; label: string; icon: string }> = [
  { key: "yesterday", label: "أمس", icon: "⏮️" },
  { key: "today", label: "اليوم", icon: "⚽" },
  { key: "tomorrow", label: "غداً", icon: "⏭️" },
];

export default async function MatchesPage() {
  let matches = fallbackMatches;
  try { const m = await getMatches(); if (m.today.length || m.tomorrow.length) matches = m; } catch { /* fallback */ }
  const all = Object.values(matches).flat();

  return (
    <div className="container">
      <div className="section-head"><h1 style={{ fontSize: 26 }}>المباريات والنتائج</h1><span className="meta">بتوقيت القاهرة · تحديث كل دقيقة</span></div>
      <div className="notice" style={{ marginBottom: 18 }}>
        {all.length} مباراة متاحة · أضف الفرق المفضلة بالضغط على ☆ وستظهر في إشعاراتك بعد تفعيلها من الأسفل.
      </div>
      <div className="day-tabs" id="tomorrow">
        {DAYS.map((d) => <a href={`#${d.key}`} key={d.key} className={d.key === "today" ? "active" : ""}>{d.icon} {d.label} ({matches[d.key].length})</a>)}
      </div>
      {DAYS.map((d) => (
        <section className="section" id={d.key} key={d.key}>
          <div className="section-head"><h2>{d.icon} {d.label}</h2></div>
          <div className="match-list">
            {matches[d.key].length
              ? matches[d.key].map((m) => <MatchCard key={m.id} match={m} />)
              : <div className="card card-body meta">لا توجد مباريات في هذا اليوم</div>}
          </div>
        </section>
      ))}
    </div>
  );
}
