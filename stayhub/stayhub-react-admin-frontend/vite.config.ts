import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 5175 — the customer app owns 5174, and the backend's CORS allowlist names both.
    port: 5175,
    strictPort: true,
  },
})
