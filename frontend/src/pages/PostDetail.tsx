import { LogIn, MessageSquare, ThumbsDown, ThumbsUp, TrendingUp, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  deleteOwnComment,
  editComment,
  getAuthorKey,
  getOnlineCount,
  getPostBySlug,
  getPostComments,
  getSettings,
  dislikePost,
  likePost,
  listPosts,
  postComment,
} from "../api/endpoints";
import type { AdminProfileSettings, Comment, Post } from "../api/types";
import { CommentEditor } from "../components/post/CommentEditor";
import { CommentItem } from "../components/post/CommentItem";

function normalizeThemeAwareTextColors(html: string): string {
  if (typeof DOMParser === "undefined") return html;

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html;

  root.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const color = element.style.color.trim();
    if (!color || color.includes("var(")) return;

    const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    const hex = color.match(/^#([\da-f]{6})$/i);
    const channels = rgb
      ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
      : hex
        ? [
            Number.parseInt(hex[1].slice(0, 2), 16),
            Number.parseInt(hex[1].slice(2, 4), 16),
            Number.parseInt(hex[1].slice(4, 6), 16),
          ]
        : null;

    if (!channels) return;
    const darkest = Math.min(...channels);
    const lightest = Math.max(...channels);
    const isNeutral = lightest - darkest <= 12;
    if (isNeutral && (darkest >= 235 || lightest <= 20)) {
      element.style.color = "var(--color-ink)";
    }
  });

  return root.innerHTML;
}

/*
 * Reconstructed from a live capture of the rendered page (public_html/
 * assets/index-BxfIvHoc.js) plus local test data seeded against post id 2
 * (see PART 1 of this session - the live DB had zero comments, so this
 * markup was undiscoverable from the live site alone).
 *
 * Two behaviours worth flagging, both verified empirically rather than
 * assumed:
 *
 * 1. "Server Latency" is a REAL measurement, not a static string like the
 *    footer's "~24ms". The original times from just before fetching the
 *    post-by-slug through the (awaited) full posts-list fetch, floored at
 *    5ms, falling back to a literal 34ms if that second fetch fails -
 *    confirmed from source (a performance.now() pair wrapping exactly
 *    those two calls). Reproduced with the same sequence and clamps.
 *
 * 2. There is NO persistent (localStorage) vote lock, despite that being
 *    the natural assumption. Confirmed empirically: after clicking
 *    Upvote, localStorage is byte-identical before and after, the button
 *    just gets a plain `disabled` React state that resets to enabled on
 *    reload - a user can refresh and vote again indefinitely. Reproduced
 *    as an in-memory "already voted this page load" flag only - a real
 *    persistent lock would be an IMPROVEMENT, not a clone.
 */

export function PostDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [articleCount, setArticleCount] = useState(5);
  const [serverLatency, setServerLatency] = useState(34);
  const [onlineCount, setOnlineCount] = useState(1);
  const [author, setAuthor] = useState<AdminProfileSettings | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [progress, setProgress] = useState(0);

  const authorKey = getAuthorKey();

  // Main data fetch, matching the original's exact sequence/timing.
  useEffect(() => {
    if (!slug) return;
    const start = performance.now();
    getPostBySlug(slug)
      .then((p) => {
        setPost(p);
        setLikes(p.likes || 0);
        setDislikes(p.dislikes || 0);
        getPostComments(p.id).then(setComments).catch(console.error);
        listPosts()
          .then((all) => {
            setArticleCount(all.filter((x) => x.status === "published").length);
            const end = performance.now();
            setServerLatency(Math.max(5, Math.round(end - start)));
          })
          .catch(() => setServerLatency(34));
      })
      .catch(console.error);
  }, [slug]);

  useEffect(() => {
    getSettings()
      .then((s) => setAuthor(s.adminProfile))
      .catch(() => {});
  }, []);

  // "Live Traffic" - independent 10s poller, matches the pattern already
  // documented for Home/Dashboard tiles (capture/interactions.md).
  useEffect(() => {
    let cancelled = false;
    function fetchOnline() {
      getOnlineCount()
        .then(({ count }) => !cancelled && typeof count === "number" && setOnlineCount(count))
        .catch(() => {});
    }
    fetchOnline();
    const interval = setInterval(fetchOnline, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Reading progress bar.
  useEffect(() => {
    function onScroll() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0);
    }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Content-protection: blocks right-click, copy, and Ctrl/Cmd+C/U/S/P.
  // A real, deliberate feature of the original (confirmed in source) -
  // reproduced as-is per "cloning, not improving," not something being
  // endorsed as good UX.
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        navigator.clipboard?.writeText("").catch(() => {});
      }
      if ((e.ctrlKey || e.metaKey) && ["c", "u", "s", "p"].includes(e.key)) {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", preventDefault);
    document.addEventListener("copy", preventDefault);
    document.addEventListener("keydown", preventKeys);
    return () => {
      document.removeEventListener("contextmenu", preventDefault);
      document.removeEventListener("copy", preventDefault);
      document.removeEventListener("keydown", preventKeys);
    };
  }, []);

  async function handleLike() {
    if (hasVoted || !post) return;
    try {
      const result = await likePost(post.id);
      setLikes(result.likes);
      setDislikes(result.dislikes);
      setHasVoted(true);
    } catch (e) {
      console.error("Like failed", e);
    }
  }

  async function handleDislike() {
    if (hasVoted || !post) return;
    try {
      const result = await dislikePost(post.id);
      setLikes(result.likes);
      setDislikes(result.dislikes);
      setHasVoted(true);
    } catch (e) {
      console.error("Dislike failed", e);
    }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!post || !displayName.trim() || !commentContent.trim()) return;
    const result = await postComment(post.id, { author_name: displayName, author_role: "Reader", content: commentContent });
    if (result.success) {
      setComments(result.comments);
      setCommentContent("");
    }
  }

  async function handleReply(parentId: number, authorName: string, content: string) {
    if (!post) return;
    const result = await postComment(post.id, { author_name: authorName, author_role: "Reader", content, parent_id: parentId });
    if (result.success) setComments(result.comments);
  }

  async function handleEdit(commentId: number, content: string) {
    await editComment(commentId, content);
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content } : c)));
  }

  async function handleDelete(commentId: number) {
    await deleteOwnComment(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId));
  }

  if (!post) return null;

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: number) => comments.filter((c) => c.parent_id === id);
  const curationPercent = likes + dislikes > 0 ? Math.round((likes / (likes + dislikes)) * 100) : 100;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: `Expert insights on ${post.title}`,
            image: post.featured_image || undefined,
            datePublished: post.published_at,
            author: author
              ? { "@type": "Person", name: author.name, jobTitle: author.title, image: author.avatar }
              : undefined,
          }),
        }}
      />
      <div
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-[var(--color-accent)] origin-left z-[60]"
        style={{ transform: `scaleX(${progress})` }}
      />
      <article className="max-w-3xl mx-auto px-6 mt-12 py-12 md:py-16 glass-panel border-x-0 md:border-x rounded-none md:rounded-2xl shadow-2xl relative">
        <div className="absolute top-0 right-0 -mr-20 w-64 h-64 bg-[var(--color-accent)]/10 rounded-full blur-[100px] pointer-events-none" />
        <Link className="text-[10px] uppercase tracking-widest text-[var(--color-accent)] font-bold hover:text-ink transition-colors mb-12 inline-block" to="/blog">
          ← Back to Archive
        </Link>
        <header className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <span className="text-[10px] text-ink/40 uppercase tracking-widest">
              {new Date((post.published_at || post.created_at).replace(" ", "T")).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {post.category_name && (
              <span className="text-[10px] text-[var(--color-accent)] font-bold uppercase tracking-widest">{post.category_name}</span>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-3xl font-serif leading-[1.1] font-medium tracking-tight text-[var(--color-ink)] mb-8">
            {post.title}
          </h1>
          {author && (
            <div className="mt-8 flex items-center gap-3 border-t border-card-border pt-6">
              <img
                alt={author.name}
                className="w-10 h-10 rounded-full object-cover border border-[var(--color-accent)]/40 shadow-sm shrink-0"
                referrerPolicy="no-referrer"
                src={author.avatar}
              />
              <div>
                <div className="text-[10px] font-bold text-ink">{author.name}</div>
                <div className="text-[9px] text-ink/40">{author.title}</div>
              </div>
            </div>
          )}
        </header>

        {post.featured_image ? (
          <figure className="mb-16 -mx-6 md:-mx-12 lg:-mx-16 rounded-none md:rounded-2xl overflow-hidden glass-panel border-x-0 p-0 shadow-xl">
            <div className="w-full aspect-video overflow-hidden bg-neutral-900/50">
              <img
                loading="lazy"
                decoding="async"
                alt={post.title}
                className="w-full h-full object-cover saturate-50 hover:saturate-100 transition-all duration-1000"
                src={post.featured_image}
              />
            </div>
          </figure>
        ) : (
          <div className="mb-16 -mx-6 md:-mx-12 lg:-mx-16 rounded-none md:rounded-2xl h-48 bg-ink/10 dark:bg-neutral-900/50 relative border-b border-t border-card-border md:border-x">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 border border-card-border rounded-full" />
              <div className="absolute w-16 h-16 border border-[var(--color-accent)]/30 rounded-full animate-pulse" />
            </div>
          </div>
        )}

        <div
          className="article-prose prose dark:prose-invert prose-lg max-w-none w-full overflow-hidden break-words whitespace-pre-wrap text-ink"
          dangerouslySetInnerHTML={{ __html: normalizeThemeAwareTextColors(post.content) }}
        />

        <div className="mt-16 p-6 rounded-2xl bg-[#000000]/5 dark:bg-ink/[0.02] border border-card-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="flex flex-col gap-1 justify-center items-center text-center p-3 border-r border-card-border last:border-r-0">
              <span className="text-[9px] uppercase tracking-wider text-ink/40">Curation Rating</span>
              <span className="text-sm text-[var(--color-accent)] font-bold flex items-center gap-1">
                <TrendingUp size={12} />
                {curationPercent}%
              </span>
              <span className="text-[9px] text-ink/30">
                {likes} likes / {dislikes} dislikes
              </span>
            </div>
            <div className="flex flex-col gap-1 justify-center items-center text-center p-3 border-r border-card-border last:border-r-0">
              <span className="text-[9px] uppercase tracking-wider text-ink/40">Live Traffic</span>
              <span className="text-sm text-green-500 dark:text-green-400 font-bold flex items-center gap-1.5 justify-center">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {onlineCount} Online
              </span>
              <span className="text-[9px] text-ink/30">active screen streams</span>
            </div>
            <div className="flex flex-col gap-1 justify-center items-center text-center p-3 border-r border-card-border last:border-r-0">
              <span className="text-[9px] uppercase tracking-wider text-ink/40">Server Latency</span>
              <span className="text-sm text-indigo-500 dark:text-indigo-400 font-bold">{serverLatency} ms</span>
              <span className="text-[9px] text-ink/30">real backend check</span>
            </div>
            <div className="flex flex-col gap-1 justify-center items-center text-center p-3">
              <span className="text-[9px] uppercase tracking-wider text-ink/40">Repository Index</span>
              <span className="text-sm text-amber-600 dark:text-amber-500 font-bold">{articleCount} Articles</span>
              <span className="text-[9px] text-ink/30">total published narratives</span>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-card-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm font-serif italic text-ink/50">Was this research module helpful?</div>
            <div className="flex items-center gap-2">
              <button
                disabled={hasVoted}
                onClick={handleLike}
                className="px-5 py-2.5 rounded-full border text-xs uppercase tracking-wider font-semibold transition-all flex items-center gap-2 bg-card-bg border-card-border text-ink/70 hover:bg-ink/10 hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ThumbsUp size={12} />
                <span>Upvote ({likes})</span>
              </button>
              <button
                disabled={hasVoted}
                onClick={handleDislike}
                className="px-5 py-2.5 rounded-full border text-xs uppercase tracking-wider font-semibold transition-all flex items-center gap-2 bg-card-bg border-card-border text-ink/70 hover:bg-ink/10 hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ThumbsDown size={12} />
                <span>Downvote ({dislikes})</span>
              </button>
            </div>
          </div>
        </div>

        {author && (
          <div className="mt-12 p-6 md:p-8 rounded-2xl bg-card-bg border border-card-border relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left relative z-10">
              <img
                alt={author.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-[var(--color-accent)] shrink-0 shadow-lg"
                referrerPolicy="no-referrer"
                src={author.avatar}
              />
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 justify-center sm:justify-start">
                  <h4 className="font-serif text-lg font-bold text-ink tracking-tight">{author.name}</h4>
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-accent)] font-semibold font-mono">{author.title}</span>
                </div>
                <p className="text-xs text-ink/65 dark:text-ink/50 leading-relaxed max-w-2xl">{author.bio}</p>
                <div className="pt-2 text-[10px] text-ink/40 dark:text-ink/30 font-mono">Platform Identity Architect & Verified Publisher</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 p-5 rounded-2xl bg-[#000000]/5 dark:bg-[#080808] border border-card-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="text-left">
            <div className="font-semibold text-ink tracking-wide">Comment with custom credentials</div>
            <div className="text-ink/40 mt-1">Register to post comments with an official Member label or write below as reader.</div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none px-4 py-2.5 bg-ink text-bg hover:opacity-90 text-[10px] uppercase font-bold tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
              <LogIn size={12} />
              Login
            </button>
            <button className="flex-1 sm:flex-none px-4 py-2.5 border border-card-border hover:border-ink/50 text-[10px] uppercase font-bold tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition-colors text-ink cursor-pointer">
              <UserPlus size={12} />
              Register
            </button>
          </div>
        </div>

        <section className="mt-16 border-t border-card-border pt-12">
          <div className="flex items-center gap-2 mb-8">
            <MessageSquare size={18} className="text-[var(--color-accent)]" />
            <h3 className="text-xl font-serif text-ink">Comments ({comments.length})</h3>
          </div>

          <form onSubmit={handleSubmitComment} className="flex flex-col gap-4 mb-10 bg-[#000000]/10 dark:bg-ink/[0.01] p-5 rounded-2xl border border-card-border">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-ink/50">Display Name</label>
              <input
                placeholder="E.g. Guest Reader"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-[#000000]/5 dark:bg-white/5 border border-card-border rounded-lg px-4 py-2.5 text-xs text-ink focus:outline-none focus:border-[var(--color-accent)]/50"
                type="text"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-ink/50">Write Comment</label>
              <CommentEditor
                value={commentContent}
                onChange={setCommentContent}
                placeholder="Share your technical critique or remarks... Use the formatting toolbar to style with bold, italic, underline, list blocks, emojis, or attached photos visually!"
              />
            </div>
            <button type="submit" className="self-end px-6 py-2.5 bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-bg)] rounded-lg text-[10px] uppercase font-bold tracking-widest transition-opacity cursor-pointer">
              Post Comment
            </button>
          </form>

          <div className="space-y-6">
            {topLevel.length === 0 && (
              <div className="text-center py-10 text-ink/30 font-serif italic text-sm">No discussion markers left yet. Leave the first footprint!</div>
            )}
            {topLevel.map((comment) => (
              <div key={comment.id} className="space-y-4">
                <CommentItem
                  comment={comment}
                  isOwned={comment.author_key === authorKey}
                  authorAvatar={author?.avatar || ""}
                  onReply={handleReply}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                >
                  {repliesOf(comment.id).map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      isReply
                      isOwned={reply.author_key === authorKey}
                      authorAvatar={author?.avatar || ""}
                      onReply={handleReply}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </CommentItem>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-24 pt-12 border-t border-card-border text-center">
          <p className="font-sans text-xs text-ink/40 mb-8 w-fit mx-auto">End of document.</p>
          <Link
            className="inline-block border border-card-border bg-card-bg px-8 py-3 rounded-lg font-semibold text-xs uppercase tracking-widest backdrop-blur-sm hover:opacity-85 transition-opacity"
            to="/blog"
          >
            Read more stories
          </Link>
        </footer>
      </article>
    </>
  );
}
