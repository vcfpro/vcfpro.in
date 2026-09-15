import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSettings } from "../api/endpoints";
import type { AboutPageSettings, PortfolioSettings } from "../api/types";

/*
 * Reconstructed field-for-field from the bundle's About component source
 * (public_html/assets/index-BxfIvHoc.js). Two things confirmed directly
 * from source rather than guessed:
 *
 * - The eyebrow label isn't a separate settings field - it's derived from
 *   the SAME headerGreeting used on the homepage:
 *   "About " + headerGreeting.replace("Hi, I'm ", "").replace("!", "")
 *   ("Hi, I'm Salman! Welcome to my blog." -> "About Salman Welcome to my
 *   blog."). If the admin ever changes headerGreeting to not start with
 *   "Hi, I'm " or not contain "!", this label would render with those
 *   literal strings still in place - reproduced as-is, not defended
 *   against, since the original doesn't defend against it either.
 * - "Designing for the Future." is a hardcoded heading, not settings-driven.
 * - The first paragraph renders settings.portfolio.aboutText (empty on the
 *   live site, hence the empty <p> in every capture) - not a bug, just an
 *   unpopulated field, same pattern as the homepage's statsLabel/Caption.
 */
export function About() {
  const [settings, setSettings] = useState<PortfolioSettings | null>(null);
  const [about, setAbout] = useState<AboutPageSettings | null>(null);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s.portfolio);
        setAbout(s.aboutPage || null);
      })
      .catch(() => {});
  }, []);

  if (!settings) return null;

  const title = about?.title?.trim() || "About Me";
  const bio = about?.bio?.trim() || settings.aboutText?.trim() || settings.headerDescription;
  const introduction = about?.introduction?.trim();
  const accolades = about?.accolades || [];
  const certifications = about?.certifications || [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} className="max-w-4xl mx-auto px-6 py-24">
      <div className="flex flex-col gap-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="inline-block mb-6 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] font-bold text-[var(--color-accent)] uppercase tracking-widest">
            About
          </div>
          <h1 className="text-5xl md:text-7xl font-serif leading-[1.1] tracking-tight italic mb-8">
            {title}
          </h1>
        </motion.div>

        <motion.div className="glass-panel p-8 md:p-12" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
          <div className="prose prose-lg max-w-none">
            {introduction && <p className="text-xl text-ink/80 font-medium leading-relaxed mb-8">{introduction}</p>}
            <p className="text-lg text-ink/75 leading-relaxed whitespace-pre-line mb-6">{bio}</p>
          </div>
        </motion.div>

        {(["Accolades", "Certifications"] as const).map((heading) => {
          const entries = heading === "Accolades" ? accolades : certifications;
          if (!entries.length) return null;
          return (
            <motion.section key={heading} className="glass-panel p-8 md:p-12" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
              <h2 className="text-2xl md:text-3xl font-serif text-ink mb-6">{heading}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {entries.filter((entry) => entry.title.trim()).map((entry, index) => (
                  <div key={`${entry.title}-${index}`} className="rounded-xl border border-card-border bg-card-bg p-5">
                    <h3 className="text-base font-semibold text-ink">{entry.title}</h3>
                    {entry.detail && <p className="mt-2 text-sm leading-relaxed text-ink/65">{entry.detail}</p>}
                  </div>
                ))}
              </div>
            </motion.section>
          );
        })}

        <motion.div className="flex justify-center mt-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }}>
          <Link
            className="border border-card-border bg-card-bg px-8 py-3 rounded-lg font-semibold text-xs uppercase tracking-widest backdrop-blur-sm hover:opacity-85 transition-opacity"
            to="/blog"
          >
            Explore the Archive
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
