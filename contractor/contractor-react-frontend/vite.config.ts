import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Tailwind v4 is a Vite plugin, not a PostCSS plugin and not a `tailwind.config.js`.
    // There is no config file in this project on purpose: the design tokens live in
    // `src/index.css` under `@theme`, which is where v4 wants them.
    tailwindcss(),
  ],
  server: {
    // 5173 is pizza, 5174/5175 are StayHub, and something else already holds 5176 on this
    // machine, so this app owns 5177.
    // `strictPort` matters: without it Vite silently moves to the next free port, and the
    // backend's CORS allowlist names 5177 and nothing else — so a silent move shows up as a
    // blank page and a CORS error rather than "that port was busy".
    port: 5177,
    strictPort: true,
  },
})
