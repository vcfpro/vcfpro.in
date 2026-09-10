import { Menu, Moon, Sun, User, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../../theme/ThemeContext";

/*
 * Reconstructed field-for-field from capture/dom/home-desktop.html and
 * capture/dom/home-mobile-menu-open-mobile.html - exact classes, exact
 * active/inactive link styling (font-bold + text-ink vs font-medium +
 * text-ink/60), exact icon set (lucide sun/moon/menu/x/user), exact button
 * titles ("Switch to Light Mode" / "Switch to Dark Mode" / "Admin Login").
 *
 * The Search button is visually reproduced (same classes/position) but not
 * wired to anything - the search overlay's actual behaviour was outside
 * this task's scope (see capture/routes.md, "Search" was captured open but
 * its contents were never parsed).
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
  const isDark = theme.mode === "dark";

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

          <button className="hidden sm:block px-5 py-2 text-[10px] uppercase tracking-widest border border-card-border rounded-full hover:bg-ink hover:text-bg transition-all flex-shrink-0 cursor-pointer text-ink">
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
            <button className="text-left text-xl tracking-widest uppercase text-ink/60">Search</button>
          </div>
        </div>
      )}
    </nav>
  );
}
