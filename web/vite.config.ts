import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Set by the GitHub Pages workflow to /<repo>/; "/" for Netlify or local dev.
  // For subdirectory deployments (e.g. /merkledrop/), set VITE_BASE=/<repo>/ in CI.
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  // VITE_* env vars are injected at build time by Vite and accessed via import.meta.env.
  // Add new env vars to web/.env.example and prefix them with VITE_ to expose them to the browser.
  define: { global: "globalThis" },
  build: { chunkSizeWarningLimit: 2000 },
});
