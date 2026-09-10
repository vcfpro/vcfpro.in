import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getOnlineCount, getSettings, listCategories, listPosts } from "../api/endpoints";
import type { AdminProfileSettings, Category, Post } from "../api/types";

/*
 * Reconstructed field-for-field from capture/dom/blog-desktop.html and
 * capture/api-usage.md ("/blog" calls categories, posts, settings,
 * stats/online, stats/ping). Exact classes, exact copy ("Archive"), exact
 * card structure. Two things not directly observable from a static DOM
 * capture, called out where implemented:
 *
 * - Category filtering is done client-side against the already-fetched
 *   post list (no separate network call per click) - consistent with the
 *   rest of the app's "fetch once, work from cache" pattern, but the
 *   original's exact click-time behaviour wasn't captured on the wire.
 * - The author avatar/name shown on every card come from
 *   settings.adminProfile, not from the post itself (there's only one
 *   author on this blog) - confirmed by every card showing the identical
 *   avatar/name in the capture.
 */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.replace(" ", "T"));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(d.getDate()).padStart(2, "0");
  return `${months[d.getMonth()]} ${day}, ${d.getFullYear()}`;
}

export function Blog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [author, setAuthor] = useState<AdminProfileSettings | null>(null);
  const [onlineCount, setOnlineCount] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    listPosts().then(setPosts).catch(() => {});
    listCategories().then(setCategories).catch(() => {});
    getSettings()
      .then((s) => setAuthor(s.adminProfile))
      .catch(() => {});
    getOnlineCount()
      .then(({ count }) => setOnlineCount(count))
      .catch(() => {});
  }, []);

  const visiblePosts = useMemo(() => {
    if (!selectedCategory) return posts;
    return posts.filter((p) => p.category_slug === selectedCategory);
  }, [posts, selectedCategory]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-5xl font-serif mb-8 text-center italic tracking-tight opacity-90 text-[var(--color-ink)]">
        Archive
      </h1>

      <div className="flex justify-center flex-col items-center gap-2 mb-12">
        <span className="text-[10px] text-green-400 font-bold flex items-center gap-1.5 uppercase tracking-widest border border-green-500/20 bg-green-500/10 px-3 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {onlineCount} Reader{onlineCount !== 1 ? "s" : ""} Online
        </span>
      </div>

      <div className="flex flex-col items-center gap-4 mb-10 w-full">
        <div className="flex flex-wrap justify-center gap-2 max-w-full">
          <button
            onClick={() => setSelectedCategory(null)}
            className={
              selectedCategory === null
                ? "px-5 py-2 rounded-full text-xs font-mono transition-all duration-300 border cursor-pointer bg-ink text-bg border-ink shadow-[0_0_15px_var(--color-accent)] font-bold scale-105"
                : "px-5 py-2 rounded-full text-xs font-mono transition-all duration-300 border cursor-pointer bg-ink/5 text-ink/75 hover:text-ink border-ink/10 hover:border-[var(--color-accent)] hover:shadow-[0_0_12px_var(--color-accent)] hover:scale-105"
            }
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={
                selectedCategory === cat.slug
                  ? "px-5 py-2 rounded-full text-xs font-mono transition-all duration-300 border cursor-pointer bg-ink text-bg border-ink shadow-[0_0_15px_var(--color-accent)] font-bold scale-105"
                  : "px-5 py-2 rounded-full text-xs font-mono transition-all duration-300 border cursor-pointer bg-ink/5 text-ink/75 hover:text-ink border-ink/10 hover:border-[var(--color-accent)] hover:shadow-[0_0_12px_var(--color-accent)] hover:scale-105"
              }
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {visiblePosts.map((post) => (
          <div key={post.id} className="group">
            <Link
              className="py-10 flex flex-col md:flex-row md:items-start gap-4 md:gap-12 glass-panel p-8 hover:border-[var(--color-accent)]/50 transition-colors duration-300 rounded-2xl"
              to={`/post/${post.slug}`}
            >
              <div className="text-sm font-mono text-ink/40 md:w-32 flex-shrink-0 mt-1">
                {formatDate(post.published_at || post.created_at)}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-serif font-medium group-hover:text-[var(--color-accent)] transition-colors mb-4">
                  {post.title}
                </h2>
                <div className="text-xs text-ink/40 leading-relaxed">{post.excerpt}</div>
              </div>
              <div className="hidden md:flex flex-col items-end shrink-0">
                {post.category_name && (
                  <div className="text-[10px] uppercase tracking-widest text-[var(--color-accent)] font-bold">
                    {post.category_name}
                  </div>
                )}
                {author && (
                  <div className="mt-8 flex items-center gap-2">
                    <img alt="Author" className="w-6 h-6 rounded-full object-cover border border-ink/10" src={author.avatar} />
                    <div className="text-[9px] text-white/30 truncate max-w-[80px]">{author.name}</div>
                  </div>
                )}
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
