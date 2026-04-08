import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    proxy: {
      "/api/bridge": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/bridge/, ""),
      },
      "/api/ai-bot": {
        target: "http://127.0.0.1:5005",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ai-bot/, ""),
      },
    },
  },
});
