import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Deployed to GitHub Pages under https://fl0wb0b.github.io/stringplaner/
export default defineConfig({
  base: "/stringplaner/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // Cache the app shell and the static JSON device/module data for offline use
        globPatterns: ["**/*.{js,css,html,svg,png,json,woff2}"],
      },
      manifest: {
        name: "Stringplaner",
        short_name: "Stringplaner",
        description:
          "Herstellerunabhängiger PV-String-Rechner: prüft Voc/Vmp/Isc-Kompatibilität von PV-Strings mit MPPT-Ladereglern und Wechselrichtern.",
        lang: "de",
        start_url: "/stringplaner/",
        scope: "/stringplaner/",
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
        ],
      },
    }),
  ],
});
