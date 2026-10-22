import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The page talks to the Bun server on 3051 (src/server), which runs the model.
export default defineConfig({
  root: "src/web",
  plugins: [react(), tailwindcss()],
  server: {
    port: 3050,
    // Anchored, so the page's own api.ts module is not sent to the server
    proxy: {
      "^/api/": "http://localhost:3051",
      "^/runs/": "http://localhost:3051",
    },
  },
  build: { outDir: "../../dist", emptyOutDir: true },
});
