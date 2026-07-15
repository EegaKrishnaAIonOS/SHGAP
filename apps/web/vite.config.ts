import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Generates the service worker with Workbox and injects the manifest
      // link + registration into index.html automatically.
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "SHG Smart Market Linkage Platform",
        short_name: "SHG Market",
        description:
          "AI-enabled Smart Market Linkage Platform for Self Help Group products — MEPMA, Andhra Pradesh.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#7e14ff",
        lang: "en",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
      },
      workbox: {
        // Precache the app shell; runtime-cache same-origin GETs so the
        // SHG-facing screens keep working on flaky/low connectivity.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ sameOrigin, request }) => sameOrigin && request.method === "GET",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "shgap-runtime" },
          },
        ],
      },
      devOptions: {
        // Lets `npm run dev` also exercise the service worker if needed;
        // does not affect the production build behaviour.
        enabled: false,
      },
    }),
  ],
});
