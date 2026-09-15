import { motion } from "framer-motion";
import { FileText, Image as ImageIcon, LayoutDashboard, LogOut, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiFetch, clearAuth } from "../api/client";

/*
 * Reconstructed field-for-field from the bundle's shared admin shell
 * (minified `qE`). Confirmed source details worth flagging:
 *
 * - No mobile nav substitute: the sidebar is `hidden md:flex` with no
 *   hamburger/drawer fallback below 768px - a real original limitation
 *   (mobile admin users have no visible nav at all), not something to
 *   improve with a drawer.
 * - "Posts" in the sidebar links straight to /admin/post/new, not a
 *   /admin/posts list route - there isn't one. Post management happens on
 *   the Dashboard table.
 * - Active-link match is `pathname === path || (path !== "/admin" &&
 *   pathname.startsWith(path))` - visiting /admin/post/5 (edit) does NOT
 *   highlight "Posts" (pathname doesn't start with "/admin/post/new").
 *   Reproduced verbatim, not "fixed" to also match edit URLs.
 * - Logout redirects to "/" (public home), not "/admin/login" - each page
 *   owns its own top-level max-w/padding wrapper (they differ: 6xl plain
 *   for Dashboard/Media, 6xl+padding for Settings, 4xl for Portfolio/Post
 *   Editor) - this shell does NOT impose a shared content-width wrapper.
 */

const NAV_ITEMS = [
  { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { name: "Posts", path: "/admin/post/new", icon: FileText },
  { name: "Media", path: "/admin/media", icon: ImageIcon },
  { name: "Portfolio", path: "/admin/portfolio", icon: FileText },
  { name: "About Page", path: "/admin/about", icon: FileText },
  { name: "Settings", path: "/admin/settings", icon: SettingsIcon },
];

export function AdminLayout() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setAuthed(null);
    console.log("[AdminLayout] Checking auth...");
    apiFetch("/auth/me")
      .then((m) => {
        console.log("[AdminLayout] Auth success", m);
        setAuthed(true);
      })
      .catch((m) => {
        console.error("[AdminLayout] Auth failed", m);
        clearAuth();
        setAuthed(false);
      });
  }, []);

  async function handleLogout() {
    clearAuth();
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    navigate("/");
  }

  if (authed === null) {
    return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-ink font-serif italic">Loading...</div>;
  }
  if (authed === false) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)] text-ink">
      <aside className="w-64 border-r border-ink/10 glass-panel fixed inset-y-0 left-0 z-40 hidden md:flex flex-col">
        <div className="h-20 flex items-center px-8 border-b border-ink/10">
          <Link to="/">
            <img
              alt="VCF PRO"
              className="h-[50px] w-auto object-contain bg-transparent drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all duration-300"
              src="/logo.svg"
            />
          </Link>
        </div>
        <nav className="flex-1 flex flex-col gap-1 p-4">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={
                  active
                    ? "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium tracking-wide bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    : "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium tracking-wide text-ink/60 hover:bg-ink/5 hover:text-ink"
                }
              >
                <Icon size={18} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-ink/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-ink/50 hover:bg-ink/5 hover:text-red-400 transition-colors w-full text-sm font-medium tracking-wide cursor-pointer"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 md:ml-64 relative min-h-screen">
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-8 md:p-12">
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
