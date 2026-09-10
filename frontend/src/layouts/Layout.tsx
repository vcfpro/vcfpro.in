import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "../components/layout/Footer";
import { Header } from "../components/layout/Header";

/*
 * Matches the reconstructed $E component: <main> gets "pt-24 pb-16" on
 * every page EXCEPT the homepage (confirmed by comparing capture/dom/home-
 * desktop.html, which has no top padding on <main>, against capture/dom/
 * blog-desktop.html and others, which do) - the homepage's own hero
 * manages its own spacing flush under the fixed nav instead.
 *
 * Scroll-to-top on route change, skipping the very first mount (matches
 * the ref-guarded effect found in the bundle - see capture/interactions.md,
 * "Global elements").
 */
export function Layout() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className={isHome ? "flex-grow" : "flex-grow pt-24 pb-16"}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
