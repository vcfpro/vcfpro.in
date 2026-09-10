import { motion } from "framer-motion";
import {
  Aperture,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Box,
  Brush,
  Camera,
  Grip,
  Layers,
  Palette,
  PenTool,
  Send,
  Sparkles,
  Type,
  WandSparkles,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSettings, listPosts, submitContactMessage } from "../api/endpoints";
import { apiFetch } from "../api/client";
import type { Post, PortfolioSettings } from "../api/types";

/*
 * Reconstructed field-for-field from the live bundle's bento-grid switch
 * statement (public_html/assets/index-BxfIvHoc.js) plus capture/dom/home-
 * desktop.html and capture/interactions.md. Default widget order (matches
 * the bundle's own fallback array when no `vcfpro_bento_layout_order`
 * localStorage override exists): timeline, disclaimer("philosophy"),
 * stats, software, accolades, contact, blogs("Recently Published").
 *
 * Deliberately NOT reproduced: the drag-to-reorder controls. They're
 * gated behind a flag that's false for every normal (non-admin) visitor -
 * confirmed by their total absence from every live capture of this page -
 * so there's nothing observable to clone here.
 *
 * The bento cards use framer-motion's `animate` (not `whileInView`) -
 * confirmed from source: `initial:{opacity:0,y:20},animate:{opacity:1,y:0},
 * transition:{type:"spring",stiffness:350,damping:30}` - i.e. they animate
 * in once on mount regardless of scroll position, not when scrolled into
 * view. The header uses a separate, simpler fade+slide-down
 * (`initial:{opacity:0,y:-20},animate:{opacity:1,y:0},transition:
 * {duration:.6,delay:.1}`).
 */

const SOFTWARE_ICONS_ROW_1 = [Figma, Framer, Palette, PenTool, Layers, Type, Aperture, Chromium];
const SOFTWARE_ICONS_ROW_2 = [Camera, Brush, Box, WandSparkles, Figma, Framer, Type, Layers];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.replace(" ", "T"));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(d.getDate()).padStart(2, "0");
  return `${months[d.getMonth()]} ${day}, ${d.getFullYear()}`;
}

function SparkleIcon({ className }: { className?: string }) {
  return <Sparkles className={className || "w-3 h-3"} strokeWidth={1.5} aria-hidden="true" />;
}

// Lucide dropped its brand/logo icons (trademark reasons) somewhere before
// the installed version (1.41.0) - Figma/Framer/Chromium all 404 from the
// package now. Reproduced directly from the exact paths captured in the
// live DOM so the marquee icon set matches regardless of package drift.
type IconProps = { className?: string; strokeWidth?: number };

function Chromium({ className, strokeWidth }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth ?? 2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10.88 21.94 15.46 14" />
      <path d="M21.17 8H12" />
      <path d="M3.95 6.06 8.54 14" />
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function Figma({ className, strokeWidth }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth ?? 2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
      <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
      <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" />
      <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z" />
      <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" />
    </svg>
  );
}

function Framer({ className, strokeWidth }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth ?? 2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 16V9h14V2H5l14 14h-7m-7 0 7 7v-7m-7 0h7" />
    </svg>
  );
}

export function Home() {
  const [settings, setSettings] = useState<PortfolioSettings | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">("idle");
  const [isAdmin, setIsAdmin] = useState(false);
  const [tileOrder, setTileOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("vcfpro_bento_layout_order") || "null");
      if (Array.isArray(saved) && saved.length >= 6) return saved as string[];
    } catch { /* use the default layout */ }
    return ["timeline", "philosophy", "stats", "software", "accolades", "contact", "blogs"];
  });

  useEffect(() => {
    getSettings()
      .then((s) => setSettings(s.portfolio))
      .catch(() => {});
    listPosts()
      .then((all) => setPosts(all.filter((p) => p.status === "published")))
      .catch(() => {});
    apiFetch("/auth/me").then(() => setIsAdmin(true)).catch(() => setIsAdmin(false));
  }, []);

  function moveTile(tile: string, direction: "up" | "prev" | "next" | "down") {
    const columns = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;
    setTileOrder((current) => {
      const from = current.indexOf(tile);
      const to = direction === "up" ? from - columns
        : direction === "down" ? from + columns
        : direction === "prev" ? from - 1
        : from + 1;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      try { localStorage.setItem("vcfpro_bento_layout_order", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  function layoutControls(tile: string) {
    if (!isAdmin) return null;
    const index = tileOrder.indexOf(tile);
    const columns = typeof window === "undefined" ? 1 : window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;
    const buttonClass = "text-white/60 hover:text-white disabled:opacity-20 disabled:cursor-default cursor-pointer p-0.5 transition-colors";
    return (
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-black/75 dark:bg-neutral-900/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-300 shadow-lg scale-95 group-hover:scale-100 pointer-events-auto">
        <button type="button" onClick={() => moveTile(tile, "up")} disabled={index < columns} title="Move Up" className={buttonClass}><ArrowUp className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => moveTile(tile, "prev")} disabled={index === 0} title="Move Left" className={buttonClass}><ArrowLeft className="w-3.5 h-3.5" /></button>
        <div className="text-[9px] text-white/50 px-1 font-mono uppercase tracking-[0.1em] select-none flex items-center gap-1"><Grip className="w-2.5 h-2.5 text-white/40" /><span>Layout</span></div>
        <button type="button" onClick={() => moveTile(tile, "next")} disabled={index === tileOrder.length - 1} title="Move Right" className={buttonClass}><ArrowRight className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => moveTile(tile, "down")} disabled={index >= tileOrder.length - columns} title="Move Down" className={buttonClass}><ArrowDown className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  function handleMessageChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount <= 200 || value.length < message.length) setMessage(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !message) return;
    setStatus("submitting");
    try {
      const result = await submitContactMessage(email, message);
      if (!result.success) throw new Error("submit failed");
      // Fire-and-forget forwarding to a third-party mail relay, matching
      // the original exactly (confirmed from source) - errors here are
      // swallowed and never affect the success state, same as upstream.
      if (settings?.email) {
        fetch(`https://formsubmit.co/ajax/${settings.email}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ _replyto: email, email, message, _subject: `New portfolio contact message from ${email}` }),
        }).catch(() => {});
      }
      setStatus("submitted");
      setEmail("");
      setMessage("");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("idle");
      alert("Failed to send message.");
    }
  }

  if (!settings) return null;

  const recentPosts = posts.slice(0, 3);
  const wordCount = message.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="w-full min-h-screen pt-24 pb-12 lg:pb-0 overflow-x-hidden font-sans antialiased text-[var(--color-ink)] transition-colors">
      <div className="px-4 sm:px-6 md:px-10 lg:px-14 py-6 sm:py-8 md:py-10 max-w-[2000px] mx-auto flex flex-col gap-8 h-full">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-col lg:flex-row items-center lg:items-center justify-between gap-8 relative z-10 shrink-0"
        >
          <div className="flex-1 max-w-4xl order-2 lg:order-1">
            <h1 className="text-[28px] sm:text-3xl md:text-4xl lg:text-[44px] leading-[1.15] tracking-tight font-normal mb-4">
              {settings.headerGreeting}
            </h1>
            <p className="text-sm md:text-[15px] leading-[1.6] opacity-60 mb-6">{settings.headerDescription}</p>
            <div className="flex items-center gap-4">
              <Link className="relative group block" to="/blog">
                <div className="absolute -inset-1 rounded-full bg-[var(--color-accent)] opacity-0 group-hover:opacity-40 blur-lg transition-opacity duration-500" />
                <div className="relative liquid-glass rounded-full px-5 sm:px-6 py-2.5 sm:py-3 cursor-pointer transition-colors flex items-center justify-center">
                  <span className="text-sm font-medium tracking-wide">{settings.buttonText || "Let's Connect"}</span>
                </div>
              </Link>
              {settings.linkedinUrl && (
                <a
                  href={settings.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative group block"
                  title="My LinkedIn Profile"
                >
                  <div className="absolute -inset-1 rounded-full bg-[var(--color-accent)] opacity-0 group-hover:opacity-40 blur-lg transition-opacity duration-500" />
                  <div className="relative p-3 rounded-full transition-colors flex items-center justify-center liquid-glass">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </div>
                </a>
              )}
            </div>
          </div>
          <div className="relative w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[360px] aspect-square order-1 lg:order-2 self-center shrink-0">
            <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-3xl -z-10 animate-pulse duration-5000" />
            <img
              alt="VCF Principal Architect"
              className="w-full h-full object-cover rounded-full select-none"
              referrerPolicy="no-referrer"
              src={settings.heroImage || "/expert.svg"}
              style={{ maskImage: "radial-gradient(circle, rgba(0,0,0,1) 42%, rgba(0,0,0,0) 68%)", WebkitMaskImage: "radial-gradient(circle, rgba(0,0,0,1) 42%, rgba(0,0,0,0) 68%)" }}
            />
          </div>
        </motion.header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 flex-1 mt-4">
          {/* timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
             style={{ order: tileOrder.indexOf("timeline") }} 
            className="col-span-1 md:row-span-2 min-h-[400px] lg:min-h-[500px] relative group overflow-hidden rounded-2xl cursor-pointer"
          >
            {layoutControls("timeline")}
            <div className="rounded-2xl glass-panel text-ink relative flex flex-col justify-between overflow-hidden p-6 md:p-8 h-full w-full shadow-2xl transition-all duration-300">
              {settings.bgVideo1 && (
                <video src={settings.bgVideo1} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-screen" />
              )}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-bg via-bg/80 to-transparent" />
              <div className="relative z-10 flex items-center justify-center gap-3">
                <SparkleIcon className="w-3 h-3 text-ink/50" />
                <span className="text-[11px] uppercase tracking-[0.22em] text-ink/70 font-semibold">{settings.timelineLabel}</span>
                <SparkleIcon className="w-3 h-3 text-ink/50" />
              </div>
              <div className="relative z-10 mt-auto grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-3 gap-y-3 md:gap-y-4 text-xs md:text-[13px] font-medium tracking-wide w-full max-w-sm">
                {settings.timeline.map((entry, i) => (
                  <Fragment key={i}>
                    <div className="text-ink text-right">{entry.year}</div>
                    <SparkleIcon className="w-3 h-3 text-ink/60 mx-1 shrink-0" />
                    <div className="text-ink/70 truncate">{entry.role}</div>
                    <div className="text-ink/40 text-right">{entry.company}</div>
                  </Fragment>
                ))}
              </div>
            </div>
          </motion.div>

          {/* disclaimer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
             style={{ order: tileOrder.indexOf("philosophy") }} 
            className="col-span-1 min-h-[220px] relative group overflow-hidden rounded-2xl cursor-pointer"
          >
            {layoutControls("philosophy")}
            <div className="rounded-2xl text-white p-6 md:p-8 lg:p-10 relative overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-2xl border border-white/15 h-full w-full" style={{ background: "linear-gradient(145deg, #050505 0%, #111111 100%)" }}>
              <div className="relative z-10 flex items-center gap-2 mb-6">
                <SparkleIcon className="w-3 h-3 text-[var(--color-accent)]" />
                <span className="text-sm uppercase tracking-[0.24em] text-[var(--color-accent)] font-bold">{settings.clientVoiceLabel}</span>
              </div>
              <div className="relative z-10 mt-auto">
                <p className="text-lg sm:text-xl lg:text-2xl leading-[1.5] text-white font-bold mb-6 italic font-serif">"{settings.clientQuote}"</p>
                <div className="text-xs">
                  <span className="font-bold text-white block text-sm">{settings.clientName}</span>
                  <span className="text-white/65 text-sm">{settings.clientRole}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* stats (background video card) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
             style={{ order: tileOrder.indexOf("stats") }} 
            className="col-span-1 min-h-[220px] relative group overflow-hidden rounded-2xl cursor-pointer"
          >
            {layoutControls("stats")}
            <div className="rounded-2xl glass-panel text-ink relative flex flex-col justify-center items-center overflow-hidden h-full min-h-[220px] w-full transition-all duration-300">
              {settings.bgVideo2 && (
                <video src={settings.bgVideo2} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen" />
              )}
              <div className="relative z-10 text-center">
                <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-[88px] font-light tracking-tight drop-shadow-2xl text-ink">{settings.statsLabel}</h2>
                <p className="mt-2 text-sm text-ink/85 tracking-wide font-medium">{settings.statsCaption}</p>
              </div>
            </div>
          </motion.div>

          {/* software */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
             style={{ order: tileOrder.indexOf("software") }} 
            className="col-span-1 min-h-[225px] relative group overflow-hidden rounded-2xl cursor-pointer"
          >
            {layoutControls("software")}
            <div className="rounded-2xl glass-panel text-ink relative flex flex-col justify-between overflow-hidden pt-6 h-full min-h-[225px] pb-4 transition-all duration-300 w-full">
              {settings.bgVideo3 && (
                <video src={settings.bgVideo3} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen" />
              )}
              <div className="relative z-10 flex items-center justify-center gap-3 px-6 pb-4">
                <span className="text-[11px] uppercase tracking-[0.22em] text-ink/70 font-semibold text-center w-full block">{settings.softwareLabel}</span>
              </div>
              <div className="relative z-10 flex-col gap-3 flex mt-auto w-full [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] overflow-hidden">
                <div className="flex gap-3 w-fit animate-marquee-left hover:[animation-play-state:paused]">
                  {[...SOFTWARE_ICONS_ROW_1, ...SOFTWARE_ICONS_ROW_1].map((Icon, i) => (
                    <div key={i} className="liquid-glass w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-xl flex items-center justify-center group pointer-events-none md:pointer-events-auto">
                      <Icon className="w-6 h-6 text-ink/60 group-hover:text-ink transition-colors" strokeWidth={1} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 w-fit animate-marquee-right hover:[animation-play-state:paused]">
                  {[...SOFTWARE_ICONS_ROW_2, ...SOFTWARE_ICONS_ROW_2].map((Icon, i) => (
                    <div key={i} className="liquid-glass w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-xl flex items-center justify-center group pointer-events-none md:pointer-events-auto">
                      <Icon className="w-6 h-6 text-ink/60 group-hover:text-ink transition-colors" strokeWidth={1} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* accolades */}
          <motion.div
            style={{ order: tileOrder.indexOf("accolades") }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="col-span-1 md:col-span-2 min-h-[225px] relative group overflow-hidden rounded-2xl cursor-pointer"
          >
            {layoutControls("accolades")}
            <div className="rounded-2xl glass-panel text-ink p-5 md:p-6 lg:p-8 relative overflow-hidden flex flex-col justify-between noise-overlay transition-all duration-300 shadow-xl border border-card-border h-full w-full">
              <div className="relative z-10 flex items-center gap-2 mb-6">
                <SparkleIcon className="w-3 h-3 text-[var(--color-accent)]" />
                <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)] font-semibold">{settings.accoladesLabel}</span>
              </div>
              <div className="relative z-10 flex flex-wrap items-center justify-start gap-4 sm:gap-6 mt-auto">
                {settings.accolades.map((acc, i) => (
                  <Fragment key={i}>
                    <div className="flex flex-col items-start gap-2 max-w-[120px] sm:max-w-none">
                      <div className={`text-xl sm:text-2xl font-black tracking-tighter opacity-90 transition-opacity drop-shadow-md ${acc.color}`}>{acc.title}</div>
                      <div className="text-[10px] text-ink/50 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                        {acc.showDot && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />}
                        {acc.subtitle}
                      </div>
                    </div>
                    {i < settings.accolades.length - 1 && <div className="w-[1px] h-10 bg-card-border hidden sm:block mx-1" />}
                  </Fragment>
                ))}
                <div className="flex-1 min-w-[20px] hidden md:block" />
                <div className="flex flex-col items-end md:items-start text-right md:text-left ml-auto md:ml-0 mt-4 sm:mt-0">
                  <div className="text-sm font-medium text-ink">{settings.accoladeLeaderTitle}</div>
                  <div className="text-xs text-ink/60 mt-1 max-w-[150px]">{settings.accoladeLeaderSubtitle}</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* contact */}
          <motion.div
            style={{ order: tileOrder.indexOf("contact") }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="col-span-1 md:col-span-2 lg:col-span-1 min-h-[350px] relative group overflow-hidden rounded-2xl cursor-pointer"
          >
            {layoutControls("contact")}
            <div className="rounded-2xl glass-panel text-ink p-5 md:p-6 lg:p-8 relative overflow-hidden flex flex-col noise-overlay transition-all duration-300 group h-full shadow-xl w-full">
              <div className="absolute top-5 right-5 lg:top-6 lg:right-6 w-9 h-9 rounded-full bg-ink/10 flex items-center justify-center z-20 group-hover:bg-ink group-hover:text-bg transition-colors cursor-pointer">
                <ArrowUpRight className="w-4 h-4 ml-[2px] mb-[2px]" />
              </div>
              <div className="relative z-10 flex items-center gap-2 mb-4">
                <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)] font-semibold">{settings.contactLabel}</span>
              </div>
              <div className="relative z-10 flex flex-col gap-1 mb-6">
                <a href={`mailto:${settings.email}`} className="text-xl md:text-2xl font-light hover:text-[var(--color-accent)] transition-colors inline-block w-fit truncate">
                  {settings.email}
                </a>
                <a href={`tel:${settings.phone || ""}`} className="text-ink/50 text-sm hover:text-ink transition-colors font-mono font-sans select-all">
                  {settings.phone}
                </a>
              </div>
              <form onSubmit={handleSubmit} className="relative z-10 w-full mt-auto flex flex-col gap-3">
                <input
                  placeholder="Your email address..."
                  className="w-full bg-ink/10 dark:bg-[#000000]/40 border border-card-border hover:border-ink/20 focus:border-[var(--color-accent)] rounded-lg py-2 px-3 text-xs font-mono text-ink outline-none transition-colors"
                  required
                  type="email"
                  value={email}
                  disabled={status !== "idle"}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="relative">
                  <textarea
                    placeholder="Type your message (max 200 words)..."
                    rows={3}
                    className="w-full bg-[#000000]/10 dark:bg-[#000000]/40 border border-card-border hover:border-ink/20 focus:border-[var(--color-accent)] rounded-lg py-2 px-3 pb-8 text-xs font-mono text-ink outline-none transition-colors resize-none"
                    required
                    value={message}
                    disabled={status !== "idle"}
                    onChange={handleMessageChange}
                  />
                  <div className="absolute right-3 bottom-2 text-[9px] font-mono text-ink/40">
                    <span>{wordCount}</span>/200 words
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={status !== "idle"}
                  className="bg-ink text-bg py-2.5 rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity text-xs font-semibold gap-2 cursor-pointer"
                >
                  {status === "submitted" ? (
                    <span className="text-[10px] font-bold px-1 text-green-600">Message Sent! ✓</span>
                  ) : (
                    <>
                      <Send className="w-3 h-3" />
                      <span>{status === "submitting" ? "Sending..." : "Send Message"}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>

          {/* recently published */}
          <motion.div
            style={{ order: tileOrder.indexOf("blogs") }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="col-span-1 min-h-[240px] relative group overflow-hidden rounded-2xl cursor-pointer"
          >
            {layoutControls("blogs")}
            <div className="rounded-2xl glass-panel text-ink p-5 md:p-6 relative overflow-hidden flex flex-col noise-overlay transition-all duration-300 shadow-xl border border-card-border h-full w-full">
              <div className="relative z-10 flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <SparkleIcon className="w-3 h-3 text-[var(--color-accent)]" />
                  <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)] font-semibold">Recently Published</span>
                </div>
                <Link className="text-[10px] uppercase font-bold tracking-widest text-ink hover:text-[var(--color-accent)] transition-all duration-300" to="/blog">
                  ARCHIVES →
                </Link>
              </div>
              <div className="relative z-10 flex flex-col gap-2.5 mt-auto">
                {recentPosts.map((post) => (
                  <Link
                    key={post.id}
                    className="group/blogitem flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-ink/5 bg-ink/10 hover:bg-black/20 hover:border-white/10 transition-all duration-300 pointer-events-auto"
                    to={`/post/${post.slug}`}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[12.5px] font-medium text-ink truncate group-hover/blogitem:text-[var(--color-accent)] transition-colors">{post.title}</h4>
                      <p className="text-[11px] text-ink/50 truncate font-light mt-0.5 font-sans">{post.excerpt}</p>
                    </div>
                    <span className="text-[9px] font-mono text-ink bg-ink/5 dark:bg-ink/5 border border-card-border/80 px-2.5 py-0.5 rounded-md shrink-0 sm:text-right font-medium text-center w-fit sm:w-auto shadow-sm select-all">
                      {formatDate(post.published_at || post.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
