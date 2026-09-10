import { useEffect, useRef } from "react";
import { useTheme } from "../theme/ThemeContext";

/*
 * The fixed full-viewport canvas found in capture/interactions.md /
 * capture/routes.md ("global elements outside <Routes>"). Two things are
 * intentionally NOT tied to the runtime theme system:
 *
 * - Its background colour is a hardcoded pair ("#050505" dark / "#F9FAFB"
 *   light) baked into the original component, NOT the admin-configured
 *   --theme-bg. #F9FAFB is subtly different from the admin's dayBg
 *   (#FAF9F6) - a real, deliberate-to-preserve inconsistency in the live
 *   site, see the --color-off-white-canvas token in index.css and
 *   capture/design-system.md.
 * - The mouse-trail effect only runs for `pointer: fine` devices at
 *   >=1024px, matching the `@media (pointer: fine) and (min-width: 1024px)`
 *   rule found in the live compiled CSS - mobile/touch gets a static
 *   coloured background and nothing else.
 */

const DESKTOP_POINTER_QUERY = "(pointer: fine) and (min-width: 1024px)";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!window.matchMedia(DESKTOP_POINTER_QUERY).matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particles: Particle[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    }));

    const mouse = { x: -1000, y: -1000 };
    const lineColor = isDark ? "99, 102, 241" : "99, 102, 241";
    const dotColor = isDark ? "rgba(129, 140, 248, 0.6)" : "rgba(99, 102, 241, 0.6)";

    function handleMouseMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
    function handleResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      if (canvas) {
        canvas.width = width;
        canvas.height = height;
      }
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleResize);

    let frameId: number;
    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) {
          const opacity = (1 - dist / 130) * (isDark ? 0.08 : 0.07);
          ctx.strokeStyle = `rgba(${lineColor}, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
      frameId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-50 h-full w-full select-none pointer-events-none transition-colors duration-300"
      style={{ backgroundColor: isDark ? "#050505" : "#F9FAFB" }}
    />
  );
}
