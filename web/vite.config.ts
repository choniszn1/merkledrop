import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Set by the GitHub Pages workflow to /<repo>/; "/" for Netlify or local dev.
  // For subdirectory deployments (e.g. /merkledrop/), set VITE_BASE=/<repo>/ in CI.
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  define: { global: "globalThis" },
  build: { chunkSizeWarningLimit: 2000 },
});
