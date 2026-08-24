import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    // 5176: pizza-react has 5173, and stayhub's two frontends take 5174 and
    // 5175. strictPort so a collision fails loudly instead of silently moving
    // the app to another port that nothing else is configured for.
    port: 5176,
    strictPort: true,
  },
  preview: { port: 4176, strictPort: true },
});
