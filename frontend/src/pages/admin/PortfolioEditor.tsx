import { Plus, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { getSettings, saveSettings, uploadMediaFile } from "../../api/endpoints";
import type { Accolade, PortfolioSettings, TimelineEntry } from "../../api/types";

/*
 * Reconstructed field-for-field from the bundle's Portfolio Editor
 * component (minified `KE`) - a single long form, not tabbed, made of 8
 * stacked glass-panel cards in a fixed order.
 *
 * Deliberate bug reproduced as-is (see the research notes this was built
 * from): four fields (timelineLabel, clientVoiceLabel, softwareLabel,
 * contactLabel) use `value={s.field || "Some Default Text"}` directly on
 * the controlled input rather than a real `placeholder` attribute. If the
 * admin never touches that field, the input LOOKS filled-in but the
 * underlying state is still "" - saving submits an empty string, not the
 * displayed fallback text. The other fields (accoladesLabel,
 * accoladeLeaderTitle/Subtitle, linkedinUrl) use real `placeholder`
 * instead and don't have this issue. Not normalized here - the whole
 * point is matching what the original actually does.
 *
 * heroImage has no URL text field at all - only a circular preview +
 * "Choose Image File" upload (immediate upload on pick, only applied to
 * settings on the next full-form Save) and a conditional "Reset to
 * Default SVG" button (hidden once heroImage is already "/expert.svg").
 *
 * Color Class for each accolade is a CLOSED six-option <select>, not free
 * text - the full option list below is exhaustive per the source.
 */

const DEFAULT_PORTFOLIO: PortfolioSettings = {
  headerGreeting: "",
  headerDescription: "",
  buttonText: "",
  timelineLabel: "",
  timeline: [],
  clientVoiceLabel: "",
  clientQuote: "",
  clientName: "",
  clientRole: "",
  statsLabel: "",
  statsCaption: "",
  softwareLabel: "",
  contactLabel: "",
  email: "",
  phone: "",
  aboutText: "",
  linkedinUrl: "",
  heroImage: "/expert.svg",
  bgVideo1: "",
  bgVideo2: "",
  bgVideo3: "",
  accoladesLabel: "",
  accoladeLeaderTitle: "",
  accoladeLeaderSubtitle: "",
  accolades: [],
};

const COLOR_OPTIONS = [
  { value: "text-inherit", label: "Default (White)" },
  { value: "text-[var(--color-accent)]", label: "Accent Color" },
  { value: "text-blue-500 dark:text-blue-400", label: "Blue" },
  { value: "text-orange-500 dark:text-orange-400", label: "Orange" },
  { value: "text-green-500 dark:text-green-400", label: "Green" },
  { value: "text-red-500 dark:text-red-400", label: "Red" },
];

const inputCls = "bg-ink/5 border border-ink/10 rounded-lg p-3 outline-none text-ink focus:border-[var(--color-accent)]";
const labelCls = "text-xs uppercase tracking-widest text-ink/40";

function PanelHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="uppercase tracking-widest text-sm text-[var(--color-accent)] font-semibold border-b border-ink/10 pb-4">{children}</h3>;
}

export function PortfolioEditor() {
  const [s, setS] = useState<PortfolioSettings>(DEFAULT_PORTFOLIO);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        if (settings.portfolio) setS({ ...DEFAULT_PORTFOLIO, ...settings.portfolio });
      })
      .catch(console.error);
  }, []);

  function field<K extends keyof PortfolioSettings>(key: K, value: PortfolioSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function updateTimeline(index: number, key: keyof TimelineEntry, value: string) {
    const next = [...s.timeline];
    next[index] = { ...next[index], [key]: value };
    setS((prev) => ({ ...prev, timeline: next }));
  }
  function addTimelineEntry() {
    setS((prev) => ({ ...prev, timeline: [...prev.timeline, { year: "", role: "", company: "" }] }));
  }
  function removeTimelineEntry(index: number) {
    setS((prev) => ({ ...prev, timeline: prev.timeline.filter((_, i) => i !== index) }));
  }

  function updateAccolade(index: number, key: keyof Accolade, value: string | boolean) {
    const next = [...s.accolades];
    next[index] = { ...next[index], [key]: value } as Accolade;
    setS((prev) => ({ ...prev, accolades: next }));
  }
  function addAccolade() {
    setS((prev) => ({ ...prev, accolades: [...(prev.accolades || []), { title: "", subtitle: "", color: "text-inherit", showDot: false }] }));
  }
  function removeAccolade(index: number) {
    setS((prev) => ({ ...prev, accolades: prev.accolades.filter((_, i) => i !== index) }));
  }

  async function handleHeroImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadMediaFile(file);
      field("heroImage", result.url);
      alert("Hero image uploaded successfully! Save main portfolio settings to apply.");
    } catch (err) {
      alert("Hero image upload failed: " + (err instanceof Error ? err.message : err));
    } finally {
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await saveSettings({ portfolio: s });
    setSaving(false);
    alert("Portfolio content saved successfully!");
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-10">
        <h1 className="text-3xl font-serif mb-2">Portfolio Content</h1>
        <p className="text-ink/40 text-sm tracking-wide">Manage the text and content on the home page.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="glass-panel p-8 rounded-2xl flex flex-col gap-6">
          <PanelHeading>Header Section</PanelHeading>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Greeting</label>
            <input className={inputCls} type="text" value={s.headerGreeting} onChange={(e) => field("headerGreeting", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} h-24 resize-y`} value={s.headerDescription} onChange={(e) => field("headerDescription", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Button Text</label>
            <input className={inputCls} type="text" value={s.buttonText || ""} onChange={(e) => field("buttonText", e.target.value)} />
          </div>
        </div>

        <div className="glass-panel p-8 rounded-2xl flex flex-col gap-6">
          <PanelHeading>Hero Section Image</PanelHeading>
          <div className="flex items-center gap-6">
            <div className="relative w-32 h-32 rounded-full overflow-hidden border border-ink/10 bg-ink/40 flex items-center justify-center shrink-0">
              {s.heroImage ? <img src={s.heroImage} alt="" className="w-full h-full object-cover" /> : <span className="text-ink/20 text-xs">No Image</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label className={`${labelCls} block`}>Upload Hero Image / Photo</label>
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-ink/5 border border-ink/10 rounded-lg hover:bg-ink/10 cursor-pointer transition-colors text-sm font-medium">
                <Upload size={16} /> Choose Image File
                <input type="file" accept="image/*" className="hidden" onChange={handleHeroImageUpload} />
              </label>
              {s.heroImage !== "/expert.svg" && (
                <button
                  type="button"
                  onClick={() => field("heroImage", "/expert.svg")}
                  className="px-4 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors text-sm font-medium cursor-pointer"
                >
                  Reset to Default SVG
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-ink/40 leading-relaxed">
            Upload your portrait or avatar. On the home page, this will be automatically styled into a perfect <strong>smooth circle</strong> that merges elegantly with the
            dark background.
          </p>
        </div>

        <div className="glass-panel p-8 rounded-2xl flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-ink/10 pb-4">
            <h3 className="uppercase tracking-widest text-sm text-[var(--color-accent)] font-semibold">Career Timeline</h3>
            <button type="button" onClick={addTimelineEntry} className="text-xs flex items-center gap-1 bg-ink/10 px-3 py-1.5 rounded hover:bg-ink/20 transition-colors cursor-pointer">
              <Plus size={14} /> Add Role
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Section Label</label>
            <input className={inputCls} type="text" value={s.timelineLabel || "Background"} onChange={(e) => field("timelineLabel", e.target.value)} />
          </div>
          {s.timeline.map((entry, i) => (
            <div key={i} className="flex gap-4 items-end bg-black/20 p-4 rounded-xl border border-ink/5">
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-xs uppercase text-ink/40">Year/Date</label>
                <input className="bg-ink/5 border border-ink/10 rounded-lg p-2 text-sm outline-none w-full" type="text" value={entry.year} onChange={(e) => updateTimeline(i, "year", e.target.value)} />
              </div>
              <div className="flex flex-col gap-2 flex-1 relative">
                <label className="text-xs uppercase text-ink/40">Role</label>
                <input className="bg-ink/5 border border-ink/10 rounded-lg p-2 text-sm outline-none w-full" type="text" value={entry.role} onChange={(e) => updateTimeline(i, "role", e.target.value)} />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-xs uppercase text-ink/40">Company/Studio</label>
                <input className="bg-ink/5 border border-ink/10 rounded-lg p-2 text-sm outline-none w-full" type="text" value={entry.company} onChange={(e) => updateTimeline(i, "company", e.target.value)} />
              </div>
              <button type="button" onClick={() => removeTimelineEntry(i)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg h-9 w-9 flex items-center justify-center shrink-0 cursor-pointer">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="glass-panel p-8 rounded-2xl flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-ink/10 pb-4">
            <h3 className="uppercase tracking-widest text-sm text-[var(--color-accent)] font-semibold">Accolades &amp; Certifications</h3>
            <button type="button" onClick={addAccolade} className="text-xs flex items-center gap-1 bg-ink/10 px-3 py-1.5 rounded hover:bg-ink/20 transition-colors cursor-pointer">
              <Plus size={14} /> Add Accolade
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Section Label</label>
            <input className={inputCls} type="text" placeholder="Accolades & Certifications" value={s.accoladesLabel || ""} onChange={(e) => field("accoladesLabel", e.target.value)} />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <label className={labelCls}>Leader Title</label>
              <input className={inputCls} type="text" placeholder="Global Leader" value={s.accoladeLeaderTitle || ""} onChange={(e) => field("accoladeLeaderTitle", e.target.value)} />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <label className={labelCls}>Leader Subtitle</label>
              <input className={inputCls} type="text" placeholder="Recognized for outstanding technical excellence" value={s.accoladeLeaderSubtitle || ""} onChange={(e) => field("accoladeLeaderSubtitle", e.target.value)} />
            </div>
          </div>
          {(s.accolades || []).map((acc, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-4 items-end bg-black/20 p-4 rounded-xl border border-ink/5">
              <div className="flex flex-col gap-2 flex-1 w-full sm:w-auto">
                <label className="text-xs uppercase text-ink/40">Title (e.g. vExpert)</label>
                <input className="bg-ink/5 border border-ink/10 rounded-lg p-2 text-sm outline-none w-full" type="text" value={acc.title} onChange={(e) => updateAccolade(i, "title", e.target.value)} />
              </div>
              <div className="flex flex-col gap-2 flex-1 w-full sm:w-auto">
                <label className="text-xs uppercase text-ink/40">Subtitle</label>
                <input className="bg-ink/5 border border-ink/10 rounded-lg p-2 text-sm outline-none w-full" type="text" value={acc.subtitle} onChange={(e) => updateAccolade(i, "subtitle", e.target.value)} />
              </div>
              <div className="flex flex-col gap-2 w-full sm:w-32">
                <label className="text-xs uppercase text-ink/40">Color Class</label>
                <select
                  className="bg-black/40 border border-ink/10 rounded-lg p-2 text-sm outline-none w-full appearance-none text-ink cursor-pointer hover:border-ink/20 transition-colors"
                  value={acc.color || "text-inherit"}
                  onChange={(e) => updateAccolade(i, "color", e.target.value)}
                >
                  {COLOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={acc.showDot} onChange={(e) => updateAccolade(i, "showDot", e.target.checked)} className="w-4 h-4 accent-[var(--color-accent)]" />
                <span className="text-xs uppercase text-ink/40">Dot</span>
              </label>
              <button type="button" onClick={() => removeAccolade(i)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg h-9 w-9 flex items-center justify-center shrink-0 cursor-pointer">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="glass-panel p-8 rounded-2xl flex flex-col gap-6">
          <PanelHeading>Client Voice (Testimonial)</PanelHeading>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Section Label</label>
            <input className={inputCls} type="text" value={s.clientVoiceLabel || "Client Voice"} onChange={(e) => field("clientVoiceLabel", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Quote</label>
            <textarea className={`${inputCls} h-24 resize-y`} value={s.clientQuote} onChange={(e) => field("clientQuote", e.target.value)} />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <label className={labelCls}>Client Name</label>
              <input className={inputCls} type="text" value={s.clientName} onChange={(e) => field("clientName", e.target.value)} />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <label className={labelCls}>Client Role</label>
              <input className={inputCls} type="text" value={s.clientRole} onChange={(e) => field("clientRole", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-2xl flex flex-col gap-6">
          <PanelHeading>Stats Card</PanelHeading>
          <div className="flex gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <label className={labelCls}>Large Label</label>
              <input className={inputCls} type="text" value={s.statsLabel} onChange={(e) => field("statsLabel", e.target.value)} />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <label className={labelCls}>Caption</label>
              <input className={inputCls} type="text" value={s.statsCaption} onChange={(e) => field("statsCaption", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-2xl flex flex-col gap-6">
          <PanelHeading>Background Videos &amp; Labels</PanelHeading>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Background Card Video URL</label>
            <input className={inputCls} type="text" value={s.bgVideo1} onChange={(e) => field("bgVideo1", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Stats Card Video URL</label>
            <input className={inputCls} type="text" value={s.bgVideo2} onChange={(e) => field("bgVideo2", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Daily Software Label</label>
            <input className={inputCls} type="text" value={s.softwareLabel || "Daily Software"} onChange={(e) => field("softwareLabel", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Software Card Video URL</label>
            <input className={inputCls} type="text" value={s.bgVideo3} onChange={(e) => field("bgVideo3", e.target.value)} />
          </div>
        </div>

        <div className="glass-panel p-8 rounded-2xl flex flex-col gap-6">
          <PanelHeading>Contact &amp; About</PanelHeading>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Contact Section Label</label>
            <input className={inputCls} type="text" value={s.contactLabel || "Reach Me"} onChange={(e) => field("contactLabel", e.target.value)} />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <label className={labelCls}>Email</label>
              <input className={inputCls} type="text" value={s.email} onChange={(e) => field("email", e.target.value)} />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <label className={labelCls}>Phone Number</label>
              <input className={inputCls} type="text" value={s.phone || ""} onChange={(e) => field("phone", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>LinkedIn Profile URL</label>
            <input className={inputCls} type="url" placeholder="https://www.linkedin.com/in/username" value={s.linkedinUrl || ""} onChange={(e) => field("linkedinUrl", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>About (Bio)</label>
            <textarea className={`${inputCls} h-24 resize-y`} value={s.aboutText || ""} onChange={(e) => field("aboutText", e.target.value)} />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="fixed bottom-8 right-8 z-50 flex items-center justify-center gap-2 bg-[var(--color-accent)] text-ink px-8 py-4 rounded-xl text-sm tracking-widest uppercase font-semibold hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(129,140,248,0.3)] cursor-pointer"
        >
          <Save size={18} /> {saving ? "Saving..." : "Save Portfolio"}
        </button>
      </form>
    </div>
  );
}
