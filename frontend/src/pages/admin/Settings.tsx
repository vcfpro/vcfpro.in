import { AlertTriangle, CheckCircle2, Key, KeyRound, Music, Palette, Save, Share2, Upload, User } from "lucide-react";
import { useEffect, useState } from "react";
import { changePassword, getSettings, saveSettings, uploadMediaFile } from "../../api/endpoints";
import type { AdminProfileSettings, MusicSettings, ThemeSettings } from "../../api/types";
import { useTheme } from "../../theme/ThemeContext";

/*
 * Reconstructed field-for-field from the bundle's Settings component
 * (minified `FE`). THREE independent <form>s, each with its own submit
 * handler and Save button - not one combined form. Confirmed behaviors:
 *
 * - Every theme field edit calls setTheme() immediately (live re-skin of
 *   the CURRENTLY OPEN admin page, before Save is even clicked) - this is
 *   the entire reason ThemeContext's setTheme writes CSS custom properties
 *   directly rather than through a re-render. Also re-writes
 *   localStorage['vcf_theme_mode'] on every edit, not just mode changes -
 *   a real side effect of reusing one setTheme call, reproduced as-is.
 * - "Save System Metrics" (theme form) saves {theme, musicSettings,
 *   adminProfile} together - not just theme. A genuine original quirk:
 *   submitting this form also re-persists whatever's currently in the
 *   Identity form's local state, even if unsaved-looking.
 * - uiSoundsEnabled has its own immediate localStorage side effect
 *   independent of Save; the music "enabled"/url fields do not.
 * - Password form is the ONLY one with an inline colour-coded banner -
 *   the other two use plain alert().
 * - Avatar/hero uploads upload immediately on file pick (a real new media
 *   item), but only update local form state - still requires the
 *   section's own Save to persist into settings.
 */

const DEFAULT_MUSIC: MusicSettings = { url: "", enabled: false, uiSoundsEnabled: false };
const DEFAULT_PROFILE: AdminProfileSettings = { name: "", avatar: "", title: "", bio: "", linkedinUrl: "" };

function setUiSoundsLocalStorage(enabled: boolean) {
  try {
    localStorage.setItem("vcf_ui_sounds_enabled", enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

function ColorField({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (name: string, value: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[9px] uppercase tracking-wider text-ink/40 font-semibold">{label}</label>
      <div className="flex items-center gap-2">
        <input
          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0 overflow-hidden shrink-0"
          type="color"
          name={name}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
        />
        <input
          className="w-full bg-ink/5 border border-ink/10 rounded-lg p-2 text-xs outline-none text-ink font-mono"
          type="text"
          name={name}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
        />
      </div>
    </div>
  );
}

export function Settings() {
  const { theme: liveTheme, setTheme } = useTheme();
  const [themeForm, setThemeForm] = useState<ThemeSettings>(liveTheme);
  const [music, setMusic] = useState<MusicSettings>(DEFAULT_MUSIC);
  const [profile, setProfile] = useState<AdminProfileSettings>(DEFAULT_PROFILE);
  const [savingMetrics, setSavingMetrics] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error" | ""; text: string }>({ type: "", text: "" });

  useEffect(() => {
    getSettings()
      .then((s) => {
        // The visitor's own localStorage['vcf_theme_mode'] override (see
        // ThemeContext.tsx) takes precedence over the saved database value
        // for what the Color Mode dropdown shows - confirmed against the
        // old server: an admin who has toggled their OWN browser to light
        // mode sees "Light Mode" pre-selected here even when the database
        // still has "dark" saved, matching the CURRENTLY LIVE theme rather
        // than silently reverting the form to the stale saved value.
        if (s.theme) {
          const storedMode = (() => {
            try {
              const m = localStorage.getItem("vcf_theme_mode");
              return m === "light" || m === "dark" ? m : null;
            } catch {
              return null;
            }
          })();
          setThemeForm({ ...s.theme, mode: storedMode ?? s.theme.mode });
        }
        if (s.musicSettings) {
          setMusic(s.musicSettings);
          setUiSoundsLocalStorage(s.musicSettings.uiSoundsEnabled);
        }
        if (s.adminProfile) setProfile(s.adminProfile);
      })
      .catch(console.error);
  }, []);

  function handleThemeFieldChange(name: string, value: string) {
    const next = { ...themeForm, [name]: value };
    setThemeForm(next);
    setTheme(next);
  }

  async function handleSaveMetrics(e: React.FormEvent) {
    e.preventDefault();
    setSavingMetrics(true);
    try {
      await saveSettings({ theme: themeForm, musicSettings: music, adminProfile: profile });
      alert("Global preferences & profile details synchronized successfully!");
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSavingMetrics(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadMediaFile(file);
      setProfile((prev) => ({ ...prev, avatar: result.url }));
      alert("Avatar uploaded successfully!");
    } catch (err) {
      alert("Avatar upload failed: " + (err instanceof Error ? err.message : err));
    } finally {
      e.target.value = "";
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await saveSettings({ adminProfile: profile });
      alert("Admin Profile details uploaded and synchronized successfully! Author E-E-A-T credentials matching active.");
    } catch (err) {
      console.error(err);
      alert("Failed to save profile: " + (err instanceof Error ? err.message : err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage({ type: "", text: "" });
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordMessage({ type: "error", text: "All password fields are required." });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: "error", text: "New password confirmation does not match." });
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordMessage({ type: "success", text: "Administrator password updated successfully!" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error(err);
      setPasswordMessage({ type: "error", text: err instanceof Error ? err.message : "Current password match failed or server error." });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-serif mb-2 tracking-tight">System Administration</h1>
        <p className="text-ink/40 text-sm tracking-wide">Configure aesthetic metrics, background soundtracks, and administrative password tokens.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <form onSubmit={handleSaveMetrics} className="space-y-8 h-full">
          <div className="glass-panel p-6 sm:p-8 rounded-2xl flex flex-col gap-6 bg-ink/[0.01]">
            <div className="flex items-center gap-2 border-b border-ink/5 pb-4 mb-2">
              <Palette size={16} className="text-[var(--color-accent)]" />
              <h3 className="uppercase tracking-widest text-xs font-bold text-ink/80">Aesthetics & Playback Prefs</h3>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-ink/50 font-semibold">Color Mode</label>
              <select
                name="mode"
                value={themeForm.mode}
                onChange={(e) => handleThemeFieldChange("mode", e.target.value)}
                className="w-full bg-ink/5 border border-ink/10 rounded-xl p-3 outline-none text-ink focus:border-[var(--color-accent)] cursor-pointer text-xs"
              >
                <option value="dark">Dark Mode (Cinematic Black)</option>
                <option value="light">Light Mode (Minimalist Silver)</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-ink/50 font-semibold">Accent Color Selection</label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  name="accentColor"
                  value={themeForm.accentColor}
                  onChange={(e) => handleThemeFieldChange("accentColor", e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border-0 p-0 overflow-hidden"
                />
                <input
                  type="text"
                  name="accentColor"
                  placeholder="#000000"
                  value={themeForm.accentColor}
                  onChange={(e) => handleThemeFieldChange("accentColor", e.target.value)}
                  className="flex-grow bg-ink/5 border border-ink/10 rounded-xl p-3 outline-none text-ink focus:border-[var(--color-accent)] font-mono text-sm"
                />
              </div>
            </div>

            <div className="border-t border-ink/5 pt-4 space-y-4">
              <h4 className="text-[10px] uppercase tracking-widest font-semibold text-ink/65">Day Mode Aesthetics (Daytime)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ColorField label="Canvas Background" name="dayBg" value={themeForm.dayBg} onChange={handleThemeFieldChange} />
                <ColorField label="System Typography (Ink)" name="dayInk" value={themeForm.dayInk} onChange={handleThemeFieldChange} />
                <ColorField label="RTE Editor Background" name="editorDayBg" value={themeForm.editorDayBg} onChange={handleThemeFieldChange} />
                <ColorField label="RTE Editor Text" name="editorDayInk" value={themeForm.editorDayInk} onChange={handleThemeFieldChange} />
              </div>
            </div>

            <div className="border-t border-ink/5 pt-4 space-y-4">
              <h4 className="text-[10px] uppercase tracking-widest font-semibold text-ink/65">Night Mode Aesthetics (Nighttime)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ColorField label="Canvas Background" name="nightBg" value={themeForm.nightBg} onChange={handleThemeFieldChange} />
                <ColorField label="System Typography (Ink)" name="nightInk" value={themeForm.nightInk} onChange={handleThemeFieldChange} />
                <ColorField label="RTE Editor Background" name="editorNightBg" value={themeForm.editorNightBg} onChange={handleThemeFieldChange} />
                <ColorField label="RTE Editor Text" name="editorNightInk" value={themeForm.editorNightInk} onChange={handleThemeFieldChange} />
              </div>
            </div>

            <div className="mt-4 pt-6 border-t border-ink/5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Music size={16} className="text-[var(--color-accent)]" />
                <h4 className="text-[11px] uppercase tracking-widest font-bold text-ink/70">Ambient Sound Orchestration</h4>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-widest text-ink/50 font-semibold">Background Audio Stream URL</label>
                <input
                  type="url"
                  placeholder="E.g. https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
                  value={music.url}
                  onChange={(e) => setMusic((prev) => ({ ...prev, url: e.target.value }))}
                  className="w-full bg-ink/5 border border-ink/10 rounded-xl p-3 outline-none text-ink focus:border-[var(--color-accent)] text-xs"
                />
                <span className="text-[9px] text-ink/30">Provide any public premium streaming `.mp3` or `.ogg` sound link.</span>
              </div>
              <div className="flex items-center gap-3 py-2 bg-ink/5 px-4 rounded-xl border border-ink/5">
                <input
                  id="musicEnabled"
                  type="checkbox"
                  checked={music.enabled}
                  onChange={(e) => setMusic((prev) => ({ ...prev, enabled: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--color-accent)] text-ink cursor-pointer bg-ink/5 border-ink/10"
                />
                <label htmlFor="musicEnabled" className="text-xs text-ink/75 cursor-pointer font-medium select-none">
                  Enable continuous quiet background soundtrack on pages
                </label>
              </div>
              <div className="flex items-center gap-3 py-2 bg-ink/5 px-4 rounded-xl border border-ink/5">
                <input
                  id="uiSoundsEnabled"
                  type="checkbox"
                  checked={music.uiSoundsEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setMusic((prev) => ({ ...prev, uiSoundsEnabled: checked }));
                    setUiSoundsLocalStorage(checked);
                  }}
                  className="w-4 h-4 rounded accent-[var(--color-accent)] text-ink cursor-pointer bg-ink/5 border-ink/10"
                />
                <label htmlFor="uiSoundsEnabled" className="text-xs text-ink/75 cursor-pointer font-medium select-none">
                  Enable UI sound effects (welcoming chimes & click indicators)
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingMetrics}
              className="flex items-center justify-center gap-2 bg-[var(--color-accent)] text-ink px-8 py-3.5 rounded-xl text-xs tracking-widest uppercase font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-lg w-full disabled:opacity-50"
            >
              <Save size={14} />
              {savingMetrics ? "Synchronizing..." : "Save System Metrics"}
            </button>
          </div>
        </form>

        <div className="space-y-8">
          <form onSubmit={handleSaveProfile} className="space-y-8">
            <div className="glass-panel p-6 sm:p-8 rounded-2xl flex flex-col gap-6 bg-ink/[0.01] border border-ink/5">
              <div className="flex items-center gap-2 border-b border-ink/5 pb-4 mb-2">
                <User size={16} className="text-blue-400" />
                <h3 className="uppercase tracking-widest text-xs font-bold text-ink/80 font-mono">Authority & Author E-E-A-T Identity</h3>
              </div>
              <p className="text-xs text-ink/50 leading-relaxed">
                Configure your public author credentials to establish Experience, Expertise, Authoritativeness, and Trustworthiness (E-E-A-T) for search engines and direct
                answer bots (AEO).
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-6 bg-ink/[0.02] p-4 rounded-xl border border-ink/5">
                <div className="relative group w-20 h-20 shrink-0">
                  <img className="w-full h-full object-cover rounded-full border-2 border-[var(--color-accent)] shadow-md" src={profile.avatar} alt="" />
                  <label className="absolute inset-0 bg-ink/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Upload size={14} />
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-xs text-ink/80 font-semibold block">Admin Profile Picture</span>
                  <p className="text-[10px] text-ink/40 leading-normal">Drag and drop or hover to upload JPG or PNG.</p>
                  <label className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer select-none transition-colors mt-1.5">
                    <Upload size={12} />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-ink/40">Author Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rohith B G"
                  value={profile.name}
                  onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-ink/5 border border-ink/10 rounded-xl p-3 outline-none text-ink focus:border-[var(--color-accent)] text-xs"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-ink/40">Professional Title / Credentials</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Founder & Principal Software Engineer"
                  value={profile.title || ""}
                  onChange={(e) => setProfile((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-ink/5 border border-ink/10 rounded-xl p-3 outline-none text-ink focus:border-[var(--color-accent)] text-xs"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-ink/40">Descriptive Expert Biography</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Qualifications and credentials to bolster E-E-A-T score."
                  value={profile.bio || ""}
                  onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
                  className="w-full bg-ink/5 border border-ink/10 rounded-xl p-3 outline-none text-ink focus:border-[var(--color-accent)] text-xs resize-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-ink/40">LinkedIn Profile URL</label>
                <input
                  type="url"
                  placeholder="https://www.linkedin.com/in/username"
                  value={profile.linkedinUrl || ""}
                  onChange={(e) => setProfile((prev) => ({ ...prev, linkedinUrl: e.target.value }))}
                  className="w-full bg-ink/5 border border-ink/10 rounded-xl p-3 outline-none text-ink focus:border-[var(--color-accent)] text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="flex items-center justify-center gap-2 bg-blue-600 text-ink px-8 py-3.5 rounded-xl text-xs tracking-widest uppercase font-bold hover:bg-blue-500 transition-colors cursor-pointer shadow-lg w-full disabled:opacity-50"
              >
                <Save size={14} />
                {savingProfile ? "Saving Profile..." : "Save Identity Credentials"}
              </button>
            </div>
          </form>

          <form onSubmit={handlePasswordSubmit} className="space-y-8 h-full">
            <div className="glass-panel p-6 sm:p-8 rounded-2xl flex flex-col gap-6 bg-ink/[0.01]">
              <div className="flex items-center gap-2 border-b border-ink/5 pb-4 mb-2">
                <KeyRound size={16} className="text-amber-500" />
                <h3 className="uppercase tracking-widest text-xs font-bold text-ink/80">Security Administration Reset</h3>
              </div>

              {passwordMessage.text && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-2.5 text-xs ${
                    passwordMessage.type === "success" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}
                >
                  {passwordMessage.type === "success" ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-ink/40">Active Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  className="w-full bg-ink/5 border border-ink/10 rounded-xl p-3 outline-none text-ink focus:border-[var(--color-accent)] text-xs"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-ink/40">Brand New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters recommended"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full bg-ink/5 border border-ink/10 rounded-xl p-3 outline-none text-ink focus:border-[var(--color-accent)] text-xs"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-ink/40">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Confirm brand new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full bg-ink/5 border border-ink/10 rounded-xl p-3 outline-none text-ink focus:border-[var(--color-accent)] text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="flex items-center justify-center gap-2 bg-amber-600 text-ink px-8 py-3.5 rounded-xl text-xs tracking-widest uppercase font-bold hover:bg-amber-500 transition-colors cursor-pointer shadow-lg w-full disabled:opacity-50"
              >
                <Key size={14} />
                {savingPassword ? "Updating Password..." : "Authorize New Password"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="mt-8">
        <div className="glass-panel p-6 sm:p-8 rounded-2xl flex flex-col gap-6 border border-ink/5 relative overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink/5 pb-4 mb-2">
            <Share2 size={16} className="text-blue-500" />
            <h3 className="uppercase tracking-widest text-xs font-bold text-ink/80">Export Application (cPanel / HostGator / Apache)</h3>
          </div>
          <p className="text-xs text-ink/50 leading-relaxed max-w-4xl">
            Download the fully compiled, production-ready static release of your VCF PRO application. This ZIP contains all necessary files (including <code>.htaccess</code>{" "}
            and API endpoints) configured for immediate deployment. Simply download the ZIP, upload it to your <code>public_html</code> directory in cPanel or HostGator, and
            extract the contents.
          </p>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-ink/40">Direct Absolute Link (Copy &amp; Paste to open in a new tab if iframe blocks download):</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  className="flex-1 bg-ink/5 border border-ink/10 rounded-lg p-3 text-xs outline-none font-mono text-blue-400 select-all"
                  type="text"
                  value={`${window.location.origin}/vcfpro-cpanel.zip`}
                />
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/vcfpro-cpanel.zip`).catch(() => {})}
                  className="px-4 py-3 bg-ink/10 hover:bg-ink/15 text-ink rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shrink-0 cursor-pointer"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="pt-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <span className="text-[10px] text-zinc-500 leading-normal max-w-2xl">Ready for production deployment. Open it in a new window/tab to start downloading.</span>
              <a
                href="/vcfpro-cpanel.zip"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center justify-center gap-2 bg-blue-600 text-ink px-8 py-3.5 rounded-xl text-xs tracking-widest uppercase font-bold hover:bg-blue-500 transition-colors cursor-pointer shadow-lg w-full md:w-auto text-center"
              >
                <Save size={14} />
                Download cPanel Release ZIP
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
