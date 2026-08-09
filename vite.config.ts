import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Deployed to GitHub Pages under der Custom Domain https://planer.fl0wb0b.com/
export default defineConfig({
  base: "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks: { recharts: ["recharts"] },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // main.tsx registers the SW itself so it can force an update check
      // on focus/visibilitychange — iOS home-screen apps otherwise rarely
      // re-check for a new version on their own.
      injectRegister: false,
      workbox: {
        // Cache the app shell and the static JSON device/module data for offline use.
        // The CEC module list is ~5 MB, so the default 2 MiB precache limit must be raised.
        globPatterns: ["**/*.{js,css,html,svg,png,json,woff2}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // Drop stale precache entries from previous deploys instead of
        // accumulating them — matters most on iOS home-screen installs,
        // which rarely get a clean service-worker restart.
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: "Stringplaner",
        short_name: "Stringplaner",
        description:
          "Herstellerunabhängiger PV-String-Rechner: prüft Voc/Vmp/Isc-Kompatibilität von PV-Strings mit MPPT-Ladereglern und Wechselrichtern.",
        lang: "de",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
      },
    }),
  ],
});
