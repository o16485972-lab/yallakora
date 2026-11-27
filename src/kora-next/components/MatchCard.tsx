"use client";

import { useEffect, useState } from "react";
import type { Match } from "@/lib/data";

const STATUS_LABEL: Record<Match["status"], string> = {
  live: "مباشر",
  finished: "انتهت",
  upcoming: "قادمة",
};

export default function MatchCard({ match }: { match: Match }) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    try {
      const list: string[] = JSON.parse(localStorage.getItem("kora_favs") || "[]");
      setFav(list.includes(`${match.home}|${match.away}`));
    } catch { /* ignore */ }
  }, [match.home, match.away]);

  function toggleFav() {
    const key = `${match.home}|${match.away}`;
    let list: string[] = [];
    try { list = JSON.parse(localStorage.getItem("kora_favs") || "[]"); } catch { /* ignore */ }
    list = fav ? list.filter((x) => x !== key) : [...list, key];
    localStorage.setItem("kora_favs", JSON.stringify(list));
    setFav(!fav);
  }

  return (
    <article className={`match ${match.status}`}>
      <div className="match-top">
        <span className="league">{match.league}</span>
        <button className={`fav-btn ${fav ? "on" : ""}`} onClick={toggleFav} aria-label={fav ? "إزالة من المفضلة" : "إضافة للمفضلة"} title="المفضلة">{fav ? "★" : "☆"}</button>
      </div>
      <div className="match-row">
        <div className="time" dir="ltr">{match.time}</div>
        <div className="team">
          <span>{match.home}</span>
          {match.homeLogo ? <img src={match.homeLogo} alt="" loading="lazy" /> : null}
        </div>
        <div className="score">
          {match.status === "upcoming" ? "×" : `${match.hs} - ${match.as}`}
          <small>{match.minute || (match.status === "live" ? "الآن" : match.league)}</small>
        </div>
        <div className="team away">
          {match.awayLogo ? <img src={match.awayLogo} alt="" loading="lazy" /> : null}
          <span>{match.away}</span>
        </div>
        <span className={`badge ${match.status}`}>{STATUS_LABEL[match.status]}</span>
      </div>
    </article>
  );
}
