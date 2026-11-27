"use client";

import { useState } from "react";

export default function ShareButtons({ title }: { title: string }) {
  const [done, setDone] = useState("");

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* fallback to copy */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setDone("تم نسخ الرابط ✓");
      window.setTimeout(() => setDone(""), 2200);
    } catch { setDone("تعذّر النسخ"); }
  }

  return (
    <div className="article-actions">
      <button className="btn" onClick={share}>🔗 مشاركة الخبر</button>
      {done ? <span className="meta" style={{ alignSelf: "center" }}>{done}</span> : null}
    </div>
  );
}
