import { Image as ImageIcon, Save, Trash2 } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RichTextEditor } from "../../components/admin/RichTextEditor";
import { createPost, deletePost, getPostById, listCategories, updatePost, uploadMediaFile } from "../../api/endpoints";
import type { Category, Post } from "../../api/types";

/*
 * Serves both /admin/post/new and /admin/post/:id from one component,
 * matching the original exactly - see EDITOR-NOTES.md for the full
 * research this was built from. Confirmed quirks reproduced as-is:
 *
 * - No slug input field anywhere. The slug is recomputed from the title
 *   at submit time, EVERY save including edits to an existing post - so
 *   renaming an existing post's title silently changes its slug too.
 * - No published-date field - not client-controlled at all.
 * - One submit button; its label is driven entirely by the Status select
 *   ("Publish" vs "Save"), there's no separate always-draft action.
 * - Delete Post (edit-mode only) has NO confirmation dialog.
 * - No Preview button/link anywhere.
 */

interface PostFormState {
  title: string;
  content: string;
  excerpt: string;
  featured_image: string;
  status: "draft" | "published";
  category_id: string;
}

const EMPTY_FORM: PostFormState = { title: "", content: "", excerpt: "", featured_image: "", status: "draft", category_id: "" };

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function PostEditor() {
  const { id } = useParams<{ id?: string }>();
  const isNew = !id;
  const navigate = useNavigate();

  const [form, setForm] = useState<PostFormState>(EMPTY_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    if (!id) {
      setForm(EMPTY_FORM);
      return;
    }
    getPostById(Number(id))
      .then((post: Post) => {
        setForm({
          title: post.title,
          content: post.content,
          excerpt: post.excerpt || "",
          featured_image: post.featured_image || "",
          status: post.status,
          category_id: post.category_id ? String(post.category_id) : "",
        });
      })
      .catch(console.error);
  }, [id]);

  function field<K extends keyof PostFormState>(key: K, value: PostFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFeaturedImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadMediaFile(file);
      field("featured_image", result.url);
    } catch (err) {
      alert("Image upload failed: " + (err instanceof Error ? err.message : err));
    } finally {
      e.target.value = "";
    }
  }

  async function handleImageUploadForEditor(file: File): Promise<string> {
    const result = await uploadMediaFile(file);
    return result.url;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      slug: slugify(form.title),
      content: form.content,
      excerpt: form.excerpt,
      featured_image: form.featured_image,
      status: form.status,
      category_id: form.category_id ? Number(form.category_id) : null,
      url: "",
    };
    try {
      if (isNew) {
        await createPost(payload);
      } else {
        await updatePost(Number(id), payload);
      }
      try {
        localStorage.removeItem("vcfpro_cached_posts");
      } catch {
        /* ignore */
      }
      navigate("/admin");
    } catch (err) {
      alert("Failed to save post: " + (err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    try {
      await deletePost(Number(id));
      try {
        localStorage.removeItem("vcfpro_cached_posts");
      } catch {
        /* ignore */
      }
      navigate("/admin");
    } catch (err) {
      alert("Failed to delete post: " + (err instanceof Error ? err.message : err));
    }
  }

  const topLevelCategories = categories.filter((c) => !c.parent_id);
  const saveLabel = saving ? "Saving..." : form.status === "published" ? "Publish" : "Save";

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-8">
      <div className="flex-1 flex flex-col gap-6">
        <h1 className="text-3xl font-serif mb-4">{isNew ? "New Post" : "Edit Post"}</h1>
        <input
          type="text"
          name="title"
          placeholder="Post Title..."
          required
          value={form.title}
          onChange={(e) => field("title", e.target.value)}
          className="bg-transparent border-b border-ink/10 pb-4 text-4xl font-serif focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        />
        <RichTextEditor
          value={form.content}
          onChange={(html) => field("content", html)}
          placeholder="Write your article narrative here. Use the formatting toolbar to style with bold, italic, underline, insert headings, quotes, bulleted lists, insert emojis, or attach photos visually!"
          minHeight="500px"
          onImageUpload={handleImageUploadForEditor}
        />
      </div>

      <div className="w-full lg:w-80 flex flex-col gap-8 shrink-0">
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="uppercase tracking-widest text-xs text-ink/50 font-semibold">Status &amp; Visibility</h3>
          </div>
          <select
            name="status"
            value={form.status}
            onChange={(e) => field("status", e.target.value as "draft" | "published")}
            className="w-full bg-ink/[0.02] border border-ink/20 rounded-xl p-3 outline-none text-orange-400 font-bold text-center tracking-wider text-xs uppercase cursor-pointer hover:bg-zinc-800 transition-colors"
          >
            <option value="draft" className="text-orange-400 bg-zinc-950 font-bold uppercase tracking-wider text-center text-xs">
              Draft
            </option>
            <option value="published" className="text-orange-400 bg-zinc-950 font-bold uppercase tracking-wider text-center text-xs">
              Published
            </option>
          </select>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-accent)] text-ink py-3.5 rounded-xl text-xs tracking-widest uppercase font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-lg disabled:opacity-50"
            >
              <Save size={18} />
              {saveLabel}
            </button>
            {!isNew && (
              <button
                type="button"
                onClick={handleDelete}
                title="Delete Post"
                className="flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-4 rounded-xl transition-colors cursor-pointer"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-6">
          <h3 className="uppercase tracking-widest text-xs text-white/50 font-semibold">Post Details</h3>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest text-white/40">Category</label>
            <select
              name="category_id"
              value={form.category_id}
              onChange={(e) => field("category_id", e.target.value)}
              className="bg-ink/40 border border-white/10 hover:border-white/20 focus:border-[var(--color-accent)] rounded-lg p-3 text-sm outline-none appearance-none text-white cursor-pointer transition-colors"
            >
              <option value="" className="bg-[#0a0a0a] text-white">
                Uncategorized
              </option>
              {topLevelCategories.map((cat) => (
                <Fragment key={cat.id}>
                  <option value={cat.id} className="bg-[#0a0a0a] text-white font-bold">
                    {cat.name}
                  </option>
                  {categories
                    .filter((c) => c.parent_id === cat.id)
                    .map((child) => (
                      <option key={child.id} value={child.id} className="bg-[#0a0a0a] text-white/80">
                        {"  — " + child.name}
                      </option>
                    ))}
                </Fragment>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest text-white/40">Excerpt</label>
            <textarea
              name="excerpt"
              value={form.excerpt}
              onChange={(e) => field("excerpt", e.target.value)}
              className="bg-ink/5 border border-white/10 rounded-lg p-3 text-sm outline-none resize-none h-24"
            />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-6">
          <h3 className="uppercase tracking-widest text-xs text-white/50 font-semibold">Featured Image</h3>
          {form.featured_image ? (
            <div className="relative group">
              <img src={form.featured_image} alt="Featured" className="w-full h-40 object-cover rounded-lg border border-white/10" />
              <button
                type="button"
                onClick={() => field("featured_image", "")}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs uppercase tracking-widest rounded-lg"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="relative border border-dashed border-white/20 rounded-lg p-6 flex flex-col items-center justify-center text-center gap-3">
              <ImageIcon size={32} className="text-white/20" />
              <p className="text-xs text-white/40">Click to upload image</p>
              <input type="file" accept="image/*" onChange={handleFeaturedImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
