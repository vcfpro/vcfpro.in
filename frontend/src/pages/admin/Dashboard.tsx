import { Award, BookOpen, Pen, Plus, ThumbsDown, ThumbsUp, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api/client";
import {
  createCategory,
  deleteCategory,
  deleteCommentAsAdmin,
  deleteContactMessage,
  deletePost,
  listAllComments,
  listCategories,
  listContactMessages,
  listPosts,
  updateCategory,
} from "../../api/endpoints";
import type { Category, Comment, ContactMessage, Post } from "../../api/types";

/*
 * Reconstructed field-for-field from the bundle's Dashboard component
 * (minified `YE`). Several deliberate original quirks reproduced as-is,
 * not "fixed":
 *
 * - The post table has NO loading state (starts as [], flashes the empty
 *   state briefly before data arrives) while Messages/Comments/Categories
 *   all have explicit "Loading..." text - a real original asymmetry.
 * - Post/message delete have zero confirmation dialogs. So does category
 *   delete. The whole bundle has no window.confirm() usage anywhere.
 * - Comment delete is optimistic (removed from state before the request
 *   resolves); post/message delete are not (they wait for the DELETE to
 *   succeed, then refetch).
 * - Category "Edit" always fails (PUT /api/categories/:id has no backend
 *   route) and "Parent Category" is silently ignored server-side - see
 *   TODO-after-parity.md. Reproduced by calling the same broken PUT, not
 *   worked around.
 * - The initial "Active Readers" number, before the first /stats/online
 *   response lands, is a deterministic time-of-day pseudo-random seed
 *   (10-1000 range) - not a placeholder "0" or "-".
 */

const ACTIVE_READERS_LABEL = "Active Readers";

function seedActiveReaders(): number {
  const now = new Date();
  const minutesOfDay = now.getHours() * 60 + now.getMinutes();
  const a = Math.sin((minutesOfDay / 1440) * 2 * Math.PI - Math.PI / 2);
  const b = Math.cos((now.getMinutes() / 60) * 2 * Math.PI);
  const blend = (a * 0.7 + b * 0.3 + 1) / 2;
  const seeded = Math.floor(10 + blend * 990);
  return Math.max(10, Math.min(1000, seeded));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [activeReaders, setActiveReaders] = useState(seedActiveReaders);

  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catParentId, setCatParentId] = useState("");
  const [editingCatId, setEditingCatId] = useState<number | null>(null);

  function fetchPosts() {
    listPosts({ status: "all" }).then(setPosts).catch(console.error);
  }
  function fetchMessages() {
    setMessagesLoading(true);
    listContactMessages()
      .then(setMessages)
      .catch(console.error)
      .finally(() => setMessagesLoading(false));
  }
  function fetchCategories() {
    setCategoriesLoading(true);
    listCategories()
      .then(setCategories)
      .catch(console.error)
      .finally(() => setCategoriesLoading(false));
  }
  function fetchComments() {
    setCommentsLoading(true);
    listAllComments()
      .then(setComments)
      .catch(console.error)
      .finally(() => setCommentsLoading(false));
  }

  useEffect(() => {
    fetchPosts();
    fetchMessages();
    fetchCategories();
    fetchComments();
    function pollOnline() {
      apiFetch<{ count: number }>("/stats/online")
        .then((r) => {
          if (r && typeof r.count === "number") setActiveReaders(r.count);
        })
        .catch(() => {});
    }
    pollOnline();
    const interval = setInterval(pollOnline, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleDeletePost(id: number) {
    try {
      await deletePost(id);
      try {
        localStorage.removeItem("vcfpro_cached_posts");
      } catch {
        /* ignore */
      }
      fetchPosts();
      console.log("Post deleted successfully");
    } catch (err) {
      console.error("Failed to delete post: " + (err instanceof Error ? err.message : err));
    }
  }

  async function handleDeleteMessage(id: number) {
    try {
      await deleteContactMessage(id);
      fetchMessages();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteComment(id: number) {
    setComments((prev) => prev.filter((c) => c.id !== id));
    try {
      await deleteCommentAsAdmin(id);
    } catch (err) {
      console.error(err);
      fetchComments();
    }
  }

  async function handleCategorySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim() || !catSlug.trim()) {
      alert("Please fill in both Category Name and Slug");
      return;
    }
    const parentId = catParentId ? Number(catParentId) : null;
    try {
      if (editingCatId) {
        await updateCategory(editingCatId, catName, catSlug, parentId);
      } else {
        await createCategory(catName, catSlug, parentId);
      }
      setCatName("");
      setCatSlug("");
      setCatParentId("");
      setEditingCatId(null);
      fetchCategories();
    } catch (err) {
      alert("Failed to save category: " + (err instanceof Error ? err.message : err));
    }
  }

  function startEditCategory(cat: Category) {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatSlug(cat.slug);
    setCatParentId(cat.parent_id ? String(cat.parent_id) : "");
    window.scrollTo({ top: 300, behavior: "smooth" });
  }

  function cancelEditCategory() {
    setEditingCatId(null);
    setCatName("");
    setCatSlug("");
    setCatParentId("");
  }

  async function handleDeleteCategory(id: number) {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    try {
      await deleteCategory(id);
    } catch (err) {
      console.error(err);
      fetchCategories();
    }
  }

  const publishedCount = posts.filter((p) => p.status === "published").length;
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const totalDislikes = posts.reduce((sum, p) => sum + (p.dislikes || 0), 0);
  const ratio = totalLikes + totalDislikes > 0 ? (totalLikes / (totalLikes + totalDislikes)) * 10 : 0;

  const topLevelCategories = categories.filter((c) => !c.parent_id);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-serif mb-2">Dashboard</h1>
          <p className="text-ink/40 text-sm tracking-wide">Manage your content and narratives.</p>
        </div>
        <Link to="/admin/post/new" className="flex items-center gap-2 bg-[var(--color-accent)] text-ink px-6 py-3 rounded-sm text-xs tracking-widest uppercase font-semibold hover:opacity-90 transition-opacity">
          <Plus size={16} />
          New Post
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-ink/[0.02] border border-ink/10 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[10px] text-ink/40 uppercase tracking-widest block mb-1 font-semibold">{ACTIVE_READERS_LABEL}</span>
            <h3 className="text-3xl font-mono font-bold text-ink">{activeReaders.toLocaleString()}</h3>
            <span className="text-[10px] text-green-500 font-mono flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live Tracking (10 - 1000 range)
            </span>
          </div>
          <div className="p-3 bg-ink/10/80 border border-ink/5 rounded-xl text-[var(--color-accent)] shrink-0">
            <Users size={20} />
          </div>
        </div>
        <div className="bg-ink/[0.02] border border-ink/10 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[10px] text-ink/40 uppercase tracking-widest block mb-1 font-semibold">Real Articles Published</span>
            <h3 className="text-3xl font-mono font-bold text-ink">{publishedCount}</h3>
            <span className="text-[10px] text-ink/30 font-mono block mt-1">From total database records status</span>
          </div>
          <div className="p-3 bg-ink/5 border border-ink/5 rounded-xl shrink-0">
            <BookOpen size={20} className="text-indigo-400" />
          </div>
        </div>
        <div className="bg-ink/[0.02] border border-ink/10 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[10px] text-ink/40 uppercase tracking-widest block mb-1 font-semibold">Curation Sentiment Rating</span>
            <h3 className="text-3xl font-mono font-bold text-[var(--color-accent)]">{ratio === 0 ? "0/10" : ratio.toFixed(1) + "/10"}</h3>
            <div className="flex items-center gap-3 text-[10px] text-ink/50 mt-1 font-mono">
              <span className="flex items-center gap-1 text-green-400 hover:text-green-300">
                <ThumbsUp size={10} />
                {totalLikes}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-red-400 hover:text-red-300">
                <ThumbsDown size={10} />
                {totalDislikes}
              </span>
            </div>
          </div>
          <div className="p-3 bg-ink/5 border border-ink/5 rounded-xl shrink-0">
            <Award size={20} className="text-amber-500" />
          </div>
        </div>
      </div>

      <div className="bg-ink/5 border border-ink/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-6 py-4 text-xs tracking-widest uppercase text-ink/50 font-medium">Title</th>
                <th className="px-6 py-4 text-xs tracking-widest uppercase text-ink/50 font-medium">Status</th>
                <th className="px-6 py-4 text-xs tracking-widest uppercase text-ink/50 font-medium">Date</th>
                <th className="px-6 py-4 text-xs tracking-widest uppercase text-ink/50 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-ink/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-serif text-lg">{post.title}</div>
                    <div className="text-ink/40 text-sm font-mono mt-1">/{post.slug}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium tracking-wide ${post.status === "published" ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                      {post.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-ink/50 font-mono">{new Date(post.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link to={`/admin/post/${post.id}`} className="text-ink/50 hover:text-ink">
                        <Pen size={16} />
                      </Link>
                      <button onClick={() => handleDeletePost(post.id)} className="text-ink/50 hover:text-red-400 cursor-pointer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {posts.length === 0 && <div className="p-12 text-center text-ink/30 font-serif italic">No posts found. Start writing.</div>}
        </div>
      </div>

      <div className="mt-16">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-ink/10 pb-5 mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-serif text-ink">Messages from Users</h2>
            <p className="text-ink/40 text-xs tracking-wide mt-1">Read and forward contact entries from your portfolio visitors.</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => {
                const header = "ID,Email,Message,Date";
                const rows = messages.map((m) => [m.id, m.email, m.message, m.created_at].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
                const csv = [header, ...rows].join("\n");
                const uri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
                const a = document.createElement("a");
                a.href = uri;
                a.download = "messages_export.csv";
                a.click();
              }}
              className="bg-ink/10 hover:bg-ink/20 text-ink px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Export CSV
            </button>
          )}
        </div>
        {messagesLoading ? (
          <div className="p-16 text-center text-ink/40 font-mono text-sm leading-8">Loading message inbox...</div>
        ) : messages.length === 0 ? (
          <div className="bg-ink/5 border border-ink/10 rounded-2xl p-12 text-center text-ink/30 font-serif italic">No contact messages received yet.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {messages.map((msg) => (
              <div key={msg.id} className="bg-ink/5 border border-ink/10 rounded-2xl p-6 hover:border-ink/20 transition-all flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold font-mono text-ink bg-ink/10 px-2.5 py-1 rounded-md">{msg.email}</span>
                    <span className="text-xs text-ink/40 font-mono">{new Date(msg.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm/relaxed text-ink/85 font-sans whitespace-pre-wrap break-words">{msg.message}</p>
                </div>
                <div className="md:w-auto shrink-0 flex flex-col gap-3 justify-end self-stretch md:border-l md:border-ink/10 md:pl-6">
                  <div className="flex gap-2 mt-auto">
                    <button
                      title="Delete Message"
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="bg-ink/5 hover:bg-red-500/20 text-ink/60 hover:text-red-400 p-2 rounded-lg border border-ink/10 hover:border-red-500/30 transition-all cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-16 pb-12">
        <div>
          <h2 className="text-2xl font-serif text-ink mb-1">Categories</h2>
          <p className="text-ink/40 text-xs tracking-wide mb-6">Add or purge content taxonomies inside your database.</p>

          <form onSubmit={handleCategorySubmit} className="glass-panel p-6 rounded-2xl flex flex-col gap-4 bg-ink/[0.01] mb-6">
            <h4 className="text-sm font-semibold text-ink">{editingCatId ? "Edit Category" : "Add New Category"}</h4>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-ink/40">Category Name</label>
              <input
                className="bg-ink/5 border border-ink/10 rounded-lg p-3 text-sm outline-none text-ink focus:border-[var(--color-accent)]"
                type="text"
                placeholder="e.g. Technology"
                value={catName}
                onChange={(e) => {
                  const value = e.target.value;
                  setCatName(value);
                  if (!editingCatId) setCatSlug(slugify(value));
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-ink/40">URL Slug</label>
              <input
                className="bg-ink/5 border border-ink/10 rounded-lg p-3 text-sm outline-none text-ink focus:border-[var(--color-accent)]"
                type="text"
                placeholder="e.g. technology"
                value={catSlug}
                onChange={(e) => setCatSlug(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-ink/40">Parent Category</label>
              <select
                className="bg-ink/5 border border-ink/10 rounded-lg p-3 text-sm outline-none text-ink focus:border-[var(--color-accent)]"
                value={catParentId}
                onChange={(e) => setCatParentId(e.target.value)}
              >
                <option value="">None (Top Level)</option>
                {topLevelCategories
                  .filter((c) => c.id !== editingCatId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" className="bg-[var(--color-accent)] text-ink px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider cursor-pointer">
                {editingCatId ? "Save Changes" : "Add Category"}
              </button>
              {editingCatId && (
                <button type="button" onClick={cancelEditCategory} className="bg-ink/10 text-ink px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider cursor-pointer">
                  Cancel
                </button>
              )}
            </div>
          </form>

          {categoriesLoading ? (
            <div className="p-8 text-center text-ink/40 font-mono text-xs animate-pulse">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="bg-ink/5 border border-ink/10 rounded-2xl p-8 text-center text-ink/30 font-serif italic">No categories designed yet.</div>
          ) : (
            <div className="bg-ink/5 border border-ink/10 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-xs uppercase text-ink/40">Name</th>
                    <th className="px-4 py-3 text-xs uppercase text-ink/40">Slug</th>
                    <th className="px-4 py-3 text-xs uppercase text-ink/40">Location</th>
                    <th className="px-4 py-3 text-xs uppercase text-ink/40 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {categories.map((cat) => {
                    const parent = cat.parent_id ? categories.find((c) => c.id === cat.parent_id) : null;
                    const location = !cat.parent_id ? "Top Level" : parent ? parent.name : "Unknown";
                    return (
                      <tr key={cat.id}>
                        <td className="px-4 py-3">{cat.parent_id ? `— ${cat.name}` : cat.name}</td>
                        <td className="px-4 py-3 text-ink/50 font-mono">{cat.slug}</td>
                        <td className="px-4 py-3 text-ink/50">{location}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button onClick={() => startEditCategory(cat)} className="text-ink/50 hover:text-ink cursor-pointer">
                              <Pen size={14} />
                            </button>
                            <button onClick={() => handleDeleteCategory(cat.id)} className="text-ink/50 hover:text-red-400 cursor-pointer">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-serif text-ink mb-1">Comment Moderation</h2>
          <p className="text-ink/40 text-xs tracking-wide mb-6">Review, monitor, or delete viewer input from your narratives.</p>
          {commentsLoading ? (
            <div className="p-16 text-center text-ink/40 font-mono text-xs animate-pulse">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="bg-ink/5 border border-ink/10 rounded-2xl p-12 text-center text-ink/30 font-serif italic">No comments shared by readers yet.</div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
              {comments.map((c) => (
                <div key={c.id} className="bg-ink/5 border border-ink/10 hover:border-ink/20 rounded-xl p-4 transition-all flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold font-mono text-ink bg-ink/10 px-2 py-0.5 rounded">{c.author_name}</span>
                      <span className="text-[10px] text-ink/30 font-mono">{c.author_role || "Reader"}</span>
                      <span className="text-[10px] text-[var(--color-accent)] font-mono truncate max-w-[150px] block" title={c.post_title || "Post"}>
                        on: {c.post_title || "Post"}
                      </span>
                    </div>
                    <p className="text-xs text-ink/70 line-clamp-3 leading-relaxed">{c.content}</p>
                    <span className="block text-[9px] text-ink/30 font-mono">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <button title="Delete Comment" onClick={() => handleDeleteComment(c.id)} className="text-ink/40 hover:text-red-400 p-2 rounded hover:bg-red-500/10 shrink-0 transition-colors cursor-pointer">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
