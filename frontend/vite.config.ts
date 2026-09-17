import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const target = process.env.SATARK_API ?? "http://127.0.0.1:8000";

// Two entry points: the static landing page at / and the console SPA under /app/.
// In dev, deep links such as /app/cases/12 fall back to the console's HTML (nginx does the same in production).
const consoleFallback = (): Plugin => ({
  name: "console-fallback",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/app(\/[^.]*)?$/.test(req.url.split("?")[0])) req.url = "/app/index.html";
      next();
    });
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), consoleFallback()],
  appType: "mpa",
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: {
    rollupOptions: {
      input: { landing: path.resolve(__dirname, "index.html"), console: path.resolve(__dirname, "app/index.html") },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
    },
  },
});
