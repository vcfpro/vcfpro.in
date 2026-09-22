import { Menu, Moon, Search, Sun, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { listPosts } from "../../api/endpoints";
import type { Post } from "../../api/types";
import { useTheme } from "../../theme/ThemeContext";

/*
 * Reconstructed field-for-field from capture/dom/home-desktop.html and
 * capture/dom/home-mobile-menu-open-mobile.html - exact classes, exact
 * active/inactive link styling (font-bold + text-ink vs font-medium +
 * text-ink/60), exact icon set (lucide sun/moon/menu/x/user), exact button
 * titles ("Switch to Light Mode" / "Switch to Dark Mode" / "Admin Login").
 *
 */

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/blog", label: "Blog" },
  { to: "/about", label: "About" },
];

export function Header() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchError, setSearchError] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isDark = theme.mode === "dark";

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    let active = true;
    listPosts()
      .then((items) => { if (active) { setPosts(items.filter((post) => post.status === "published")); setSearchError(false); } })
      .catch(() => { if (active) setSearchError(true); });
    return () => { active = false; };
  }, [searchOpen]);

  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const results = terms.length
    ? posts.filter((post) => terms.every((term) => `${post.title} ${post.excerpt} ${post.category_name || ""} ${post.content.replace(/<[^>]*>/g, " ")}`.toLocaleLowerCase().includes(term)))
    : [];

  function openSearch() {
    setMobileMenuOpen(false);
    setSearchOpen(true);
  }

  function toggleTheme() {
    setTheme({ ...theme, mode: isDark ? "light" : "dark" });
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-12 py-6 border-b border-card-border bg-bg/80 backdrop-blur-xl transition-[background-color,border-color] duration-300">
      <div className="flex w-full max-w-7xl mx-auto items-center justify-between">
        <div className="flex items-center gap-2">
          <Link className="inline-block" to="/">
            <img
              alt="VCF PRO"
              className="h-[50px] w-auto object-contain bg-transparent drop-shadow-[0_0_12px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all duration-300"
              src="/logo.svg"
            />
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map((link) => {
            const active = location.pathname === link.to;
            return (
              <div key={link.to}>
                <Link
                  className={
                    active
                      ? "text-xs uppercase tracking-widest transition-colors inline-block text-ink font-bold"
                      : "text-xs font-medium uppercase tracking-widest transition-colors inline-block text-ink/60 hover:text-ink"
                  }
                  to={link.to}
                >
                  {link.label}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <button
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            onClick={toggleTheme}
            className="w-10 h-10 rounded-full border border-card-border flex items-center justify-center text-ink/70 hover:text-ink hover:bg-ink/10 transition-all flex-shrink-0 cursor-pointer"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button type="button" onClick={openSearch} aria-haspopup="dialog" className="hidden sm:block px-5 py-2 text-[10px] uppercase tracking-widest border border-card-border rounded-full hover:bg-ink hover:text-bg transition-all flex-shrink-0 cursor-pointer text-ink">
            Search
          </button>

          <Link
            title="Admin Login"
            className="hidden md:flex w-10 h-10 rounded-full border border-card-border items-center justify-center text-ink/70 hover:text-ink hover:bg-ink/10 transition-colors flex-shrink-0"
            to="/admin"
          >
            <User size={16} />
          </Link>

          <button
            className="md:hidden text-ink/70 hover:text-ink ml-2 flex-shrink-0 cursor-pointer"
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="absolute top-full left-0 w-full overflow-hidden md:hidden bg-bg/95 backdrop-blur-3xl border-b border-card-border shadow-2xl z-50">
          <div className="px-6 py-8 flex flex-col gap-6">
            {NAV_LINKS.map((link) => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  className={`text-xl tracking-widest uppercase ${active ? "text-ink" : "text-ink/60"}`}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
            <button type="button" onClick={openSearch} className="text-left text-xl tracking-widest uppercase text-ink/60">Search</button>
          </div>
        </div>
      )}
      {searchOpen && (
        <div role="presentation" className="fixed inset-0 z-[70] h-screen bg-black/65 backdrop-blur-sm p-4 pt-24 md:pt-32" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Search posts" className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-card-border bg-bg shadow-2xl">
            <div className="flex items-center gap-3 border-b border-card-border p-4 md:p-6">
              <Search size={20} className="shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
              <input ref={searchInputRef} type="search" aria-label="Search posts" placeholder="Search articles..." value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-lg text-ink outline-none placeholder:text-ink/40" />
              <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search" className="rounded-full p-2 text-ink/60 hover:bg-ink/10 hover:text-ink"><X size={20} /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3 md:p-4">
              {searchError ? <p role="status" className="p-4 text-sm text-ink/60">Search is unavailable right now. Please try again.</p>
                : !terms.length ? <p className="p-4 text-sm text-ink/55">Search titles, topics, or article text.</p>
                : results.length === 0 ? <p role="status" className="p-4 text-sm text-ink/60">No articles found for “{query.trim()}”.</p>
                : results.map((post) => (
                  <Link key={post.id} to={`/post/${post.slug}`} onClick={() => { setSearchOpen(false); setQuery(""); }} className="block rounded-xl p-4 text-ink transition-colors hover:bg-ink/10 focus:bg-ink/10">
                    <span className="text-xs uppercase tracking-widest text-[var(--color-accent)]">{post.category_name || "Article"}</span>
                    <span className="mt-1 block font-serif text-xl">{post.title}</span>
                    {post.excerpt && <span className="mt-2 block text-sm text-ink/55 line-clamp-2">{post.excerpt}</span>}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
