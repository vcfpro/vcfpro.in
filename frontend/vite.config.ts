import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Tailwind runs via postcss.config.js (@tailwindcss/postcss) rather than
// the @tailwindcss/vite plugin. Both work fine - the actual root cause of
// an earlier "custom @theme values never take effect" bug here was a typo
// in src/index.css (a comment containing the literal text `--theme-*/--
// color-*`, which is an accidental CSS comment-close token sequence that
// truncated the whole file's theme block); the plugin switch happened
// while tracking that down and was kept since it works, not because the
// Vite plugin was ever actually at fault.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Deploy copies dist/ contents into public_html/ manually - never point
    // this at public_html/ directly, or a build would wipe out api/,
    // uploads/, and .htaccess on the next `npm run build`.
    outDir: 'dist',
  },
  server: {
    proxy: {
      // The local PHP harness from local-dev/ - see local-dev/README.md.
      '/api': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
    },
  },
})
