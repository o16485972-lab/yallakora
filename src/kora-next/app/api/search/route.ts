import { getMatches, getNews } from "@/lib/data";

export const revalidate = 300;

type SearchItem = { title: string; excerpt: string; href: string; type: "خبر" | "مباراة"; meta: string };

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return Response.json({ items: [] as SearchItem[] }, { headers: CORS });

  const term = q.toLocaleLowerCase("ar");
  const [news, matches] = await Promise.all([getNews(30), getMatches()]);
  const newsItems: SearchItem[] = news
    .filter((n) => `${n.title} ${n.excerpt} ${n.source}`.toLocaleLowerCase("ar").includes(term))
    .map((n) => ({ title: n.title, excerpt: n.excerpt, href: `/news/${n.slug}`, type: "خبر", meta: n.source }));

  const matchItems: SearchItem[] = ([] as typeof matches.today)
    .concat(matches.yesterday, matches.today, matches.tomorrow)
    .filter((m) => `${m.home} ${m.away} ${m.league}`.toLocaleLowerCase("ar").includes(term))
    .map((m) => ({
      title: `${m.home} × ${m.away}`,
      excerpt: m.status === "upcoming" ? `قادمة الساعة ${m.time}` : `النتيجة ${m.hs} - ${m.as}`,
      href: "/matches",
      type: "مباراة",
      meta: m.league,
    }));

  return Response.json(
    { items: [...newsItems, ...matchItems].slice(0, 14) },
    { headers: { ...CORS, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
