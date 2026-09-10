import { useEffect, useState } from "react";
import { getOnlineCount, listPosts, pingStats } from "../../api/endpoints";

/*
 * Reconstructed from capture/dom/home-desktop.html and capture/dom/blog-
 * desktop.html (identical markup on both - this is the persistent
 * site-wide footer, confirmed in capture/routes.md). Exact classes, exact
 * copy ("System Active", "Made by Rohith P Chachu", "Server Latency:
 * ~24ms" - the latency string never varied across dozens of captures on
 * different days, so it's reproduced as the same fixed string rather than
 * a real measurement).
 *
 * Curation Rating: no API field for this exists (see capture/api-usage.md)
 * - reverse-engineered from the numbers actually observed: 3 total likes,
 * 0 dislikes, "10.0/10" and the admin dashboard's identical figure line up
 * exactly with (likes / (likes + dislikes)) * 10, defaulting to 10.0 when
 * no votes exist yet (a "no negative feedback" default, not a real 10/10).
 *
 * Polling: matches capture/interactions.md exactly - ping and online-count
 * both fire immediately on mount, then every 15s, independently of the
 * other pollers on Home/Dashboard (which is the live site's actual
 * behaviour, redundant as that is - see capture/interactions.md).
 */
export function Footer() {
  const [onlineCount, setOnlineCount] = useState(1);
  const [articleCount, setArticleCount] = useState<number | null>(null);
  const [curationRating, setCurationRating] = useState("10.0");

  useEffect(() => {
    let cancelled = false;

    async function fetchOnline() {
      try {
        const { count } = await getOnlineCount();
        if (!cancelled && typeof count === "number") setOnlineCount(count);
      } catch {
        /* keep last known value, matches original's silent catch */
      }
    }

    pingStats();
    fetchOnline();
    const pingInterval = setInterval(pingStats, 15000);
    const onlineInterval = setInterval(fetchOnline, 15000);

    return () => {
      cancelled = true;
      clearInterval(pingInterval);
      clearInterval(onlineInterval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listPosts()
      .then((posts) => {
        if (cancelled) return;
        setArticleCount(posts.length);
        const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
        const totalDislikes = posts.reduce((sum, p) => sum + (p.dislikes || 0), 0);
        const totalVotes = totalLikes + totalDislikes;
        const rating = totalVotes > 0 ? (totalLikes / totalVotes) * 10 : 10;
        setCurationRating(rating.toFixed(1));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="relative z-10 px-6 md:px-12 py-8 border-t border-ink/5 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0 mt-[auto]">
      <div className="flex gap-8 md:gap-12">
        <div>
          <div className="text-[9px] text-ink/30 uppercase tracking-widest mb-1">Readers Online</div>
          <div className="text-lg font-mono tracking-tighter text-white">{onlineCount}</div>
        </div>
        <div>
          <div className="text-[9px] text-white/30 uppercase tracking-widest mb-1">Articles Published</div>
          <div className="text-lg font-mono tracking-tighter text-white">{articleCount ?? "-"}</div>
        </div>
        <div className="hidden sm:block">
          <div className="text-[9px] text-white/30 uppercase tracking-widest mb-1">Curation Rating</div>
          <div className="text-lg font-mono tracking-tighter text-[var(--color-accent)]">{curationRating}/10</div>
        </div>
      </div>

      <div className="group relative cursor-default">
        <span className="text-[10px] text-white/5 uppercase tracking-tighter group-hover:text-[var(--color-accent)]/40 transition-colors duration-500">
          System Active
        </span>
        <div className="absolute bottom-full right-1/2 translate-x-1/2 md:translate-x-0 md:right-0 mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="bg-ink/80 backdrop-blur-md border border-white/10 px-3 py-1 rounded text-[9px] text-white/50 whitespace-nowrap shadow-xl">
            Made by <span className="text-white">Rohith P Chachu</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 hidden sm:flex">
        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
        <span className="text-[10px] text-white/30 uppercase tracking-widest">Server Latency: ~24ms</span>
      </div>
    </footer>
  );
}
