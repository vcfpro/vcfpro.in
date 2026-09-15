import { ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSettings, saveSettings, uploadMediaFile } from "../../api/endpoints";
import type { AboutEntry, AboutPageSettings } from "../../api/types";

const EMPTY_ABOUT: AboutPageSettings = {
  title: "About Me",
  introduction: "",
  bio: "",
  accolades: [],
  certifications: [],
};

const inputClass = "w-full rounded-lg border border-ink/15 bg-ink/5 p-3 text-ink outline-none focus:border-[var(--color-accent)]";

export function AboutEditor() {
  const [content, setContent] = useState<AboutPageSettings>(EMPTY_ABOUT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getSettings().then((settings) => {
      setContent({
        ...EMPTY_ABOUT,
        bio: settings.portfolio?.aboutText || settings.portfolio?.headerDescription || "",
        ...settings.aboutPage,
        accolades: settings.aboutPage?.accolades || [],
        certifications: settings.aboutPage?.certifications || [],
      });
    }).catch(() => setMessage("Could not load About content. Please retry."));
  }, []);

  function updateField(key: "title" | "introduction" | "bio", value: string) {
    setContent((current) => ({ ...current, [key]: value }));
  }

  function updateEntry(section: "accolades" | "certifications", index: number, key: keyof AboutEntry, value: string) {
    setContent((current) => ({
      ...current,
      [section]: current[section].map((entry, i) => i === index ? { ...entry, [key]: value } : entry),
    }));
  }

  async function handleImageUpload(section: "accolades" | "certifications", index: number, file: File) {
    setUploading(true);
    setMessage("");
    try {
      const result = await uploadMediaFile(file);
      updateEntry(section, index, "imageUrl", result.url);
      setMessage("Badge uploaded. Save the About page to publish it.");
    } catch {
      setMessage("Image upload failed. Please try another image.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await saveSettings({ aboutPage: {
        ...content,
        accolades: content.accolades.filter((entry) => entry.title.trim()),
        certifications: content.certifications.filter((entry) => entry.title.trim()),
      } });
      setMessage("About page saved. View the public page to confirm your changes.");
    } catch {
      setMessage("Save failed. Your edits are still here; please retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif text-ink">Edit About Page</h1>
          <p className="mt-2 text-sm text-ink/55">Update the public biography, accolades, and certifications.</p>
        </div>
        <Link to="/about" className="rounded-lg border border-card-border px-4 py-2 text-xs text-ink hover:bg-ink/5">View Page</Link>
      </div>
      <form onSubmit={handleSave} className="space-y-7">
        <section className="glass-panel rounded-2xl p-6 md:p-8 space-y-5">
          <h2 className="text-lg font-serif text-ink">Introduction</h2>
          <label className="block text-xs uppercase tracking-widest text-ink/55">Page Title
            <input className={`${inputClass} mt-2`} value={content.title} onChange={(event) => updateField("title", event.target.value)} required />
          </label>
          <label className="block text-xs uppercase tracking-widest text-ink/55">Introductory Line
            <textarea className={`${inputClass} mt-2 min-h-24 resize-y normal-case tracking-normal`} value={content.introduction} onChange={(event) => updateField("introduction", event.target.value)} placeholder="A short introduction (optional)" />
          </label>
          <label className="block text-xs uppercase tracking-widest text-ink/55">Biography
            <textarea className={`${inputClass} mt-2 min-h-56 resize-y normal-case tracking-normal`} value={content.bio} onChange={(event) => updateField("bio", event.target.value)} placeholder="Tell visitors about your experience" />
          </label>
        </section>
        {(["accolades", "certifications"] as const).map((section) => (
          <section key={section} className="glass-panel rounded-2xl p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-serif capitalize text-ink">{section}</h2>
              <button type="button" onClick={() => setContent((current) => ({ ...current, [section]: [...current[section], { title: "", detail: "" }] }))} className="flex items-center gap-2 rounded-lg border border-card-border px-3 py-2 text-xs text-ink hover:bg-ink/5"><Plus size={14} /> Add {section === "accolades" ? "Accolade" : "Certification"}</button>
            </div>
            {content[section].length === 0 && <p className="text-sm text-ink/45">No entries yet. Add one when you are ready.</p>}
            {content[section].map((entry, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end rounded-xl border border-card-border p-4">
                <label className="text-xs text-ink/55">Title<input className={`${inputClass} mt-2`} value={entry.title} onChange={(event) => updateEntry(section, index, "title", event.target.value)} placeholder={section === "certifications" ? "Certification name" : "Accolade name"} /></label>
                <label className="text-xs text-ink/55">Detail<input className={`${inputClass} mt-2`} value={entry.detail} onChange={(event) => updateEntry(section, index, "detail", event.target.value)} placeholder="Issuer, year, or description" /></label>
                <button type="button" disabled={uploading} title="Remove Entry" onClick={() => setContent((current) => ({ ...current, [section]: current[section].filter((_, i) => i !== index) }))} className="rounded-lg border border-red-500/20 p-3 text-red-400 hover:bg-red-500/10 disabled:opacity-50"><Trash2 size={17} /></button>
                <div className="sm:col-span-3 rounded-lg border border-dashed border-card-border bg-ink/5 p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    {entry.imageUrl ? <img src={entry.imageUrl} alt={entry.title || `${section} badge preview`} className="h-24 w-40 rounded-md bg-white object-contain" /> : <div className="flex h-24 w-40 items-center justify-center rounded-md border border-card-border text-ink/35"><ImagePlus size={28} aria-hidden="true" /></div>}
                    <div className="flex flex-col items-start gap-2">
                      <label className="cursor-pointer rounded-lg border border-card-border px-3 py-2 text-xs text-ink hover:bg-ink/5">
                        {uploading ? "Uploading..." : entry.imageUrl ? "Replace badge image" : "Upload badge image"}
                        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={uploading} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImageUpload(section, index, file); event.target.value = ""; }} />
                      </label>
                      {entry.imageUrl && <button type="button" onClick={() => updateEntry(section, index, "imageUrl", "")} className="text-xs text-ink/55 underline hover:text-ink">Remove image</button>}
                      <span className="text-xs text-ink/45">Optional. Badge images keep their original shape.</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        ))}
        <div className="flex items-center justify-between gap-4">
          <p role="status" className="text-sm text-ink/65">{message}</p>
          <button type="submit" disabled={saving || uploading} className="flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-bold text-[var(--color-bg)] disabled:opacity-60"><Save size={17} />{saving ? "Saving..." : "Save About Page"}</button>
        </div>
      </form>
    </div>
  );
}
