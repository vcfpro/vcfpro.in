import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/*
 * The invisible full-viewport div documented in capture/interactions.md -
 * `fixed inset-0 pointer-events-none z-[99999] transition-opacity
 * duration-500 ease-in-out opacity-0`, paired with an app-root effect that
 * fires on every pathname change EXCEPT the first mount (guarded by a ref).
 *
 * The element and its trigger timing are confirmed from the bundle; the
 * exact visual intensity/colour of whatever it fades to was not traceable
 * from the minified source (only that something is called on route change -
 * see capture/interactions.md, "Global elements"). This is a reasonable
 * placeholder for the documented mechanism - a brief low-opacity flash of
 * the current theme background - not a guaranteed pixel-perfect match.
 */
export function RouteTransitionOverlay() {
  const location = useLocation();
  const isFirstRender = useRef(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setVisible(true);
    const timeout = setTimeout(() => setVisible(false), 150);
    return () => clearTimeout(timeout);
  }, [location.pathname]);

  return (
    <div
      className="fixed inset-0 z-[99999] pointer-events-none bg-bg transition-opacity duration-500 ease-in-out"
      style={{ opacity: visible ? 0.6 : 0 }}
    />
  );
}
