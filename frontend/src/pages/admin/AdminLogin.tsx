import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../api/endpoints";

/*
 * Reconstructed from capture/dom/admin-login-desktop.html - a standalone
 * screen (no Header/Footer, no AdminLayout sidebar - this route sits
 * outside /admin's layout in App.tsx). Confirmed no "Register account"
 * toggle renders here even though the bundle contains dead code for one
 * (see capture/interactions.md, "Dead/unreachable code found").
 */
export function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 rounded-2xl glass-panel shadow-2xl shadow-black/50"
      >
        <div className="text-center mb-10 flex flex-col items-center">
          <img
            alt="VCF PRO"
            className="h-[60px] w-auto object-contain bg-transparent mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all duration-300"
            src="/logo.svg"
          />
          <p className="text-ink/40 text-xs tracking-widest uppercase">Admin Login</p>
        </div>
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-4 rounded-lg mb-6">{error}</div>}
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest text-white/50">Username</label>
            <input
              className="bg-ink/5 border border-ink/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors"
              required
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest text-white/50">Password</label>
            <input
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors"
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="mt-4 bg-white text-black hover:bg-white/90 py-3 rounded-lg text-sm tracking-widest uppercase font-semibold transition-colors cursor-pointer">
            Access Dashboard
          </button>
        </form>
      </motion.div>
    </div>
  );
}
