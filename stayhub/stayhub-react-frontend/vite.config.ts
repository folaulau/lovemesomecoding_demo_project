import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Tailwind v4 is a Vite PLUGIN, not a PostCSS plugin. There is no tailwind.config.js and no
  // postcss.config.js — configuration lives in CSS via @theme. Following a v3 tutorial here
  // produces a build that runs and silently applies no styles at all.
  plugins: [react(), tailwindcss()],
  server: {
    // 5174, not Vite's default 5173: that port belongs to the pizza demo, and the backend's CORS
    // allowlist names this one explicitly.
    port: 5174,
    strictPort: true,
  },
})
