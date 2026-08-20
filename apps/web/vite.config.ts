import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// core-api (apps/core-api) has no CORS middleware configured, and T07 is
// scoped to apps/web only — it must not be touched here. Rather than fight
// browser CORS from a cross-origin dev server, the web app talks to a
// same-origin `/api` path (see src/lib/api/httpClient.ts) which Vite proxies
// straight through to core-api, both in `dev` and in `preview`. A real
// deployment would front both with a single reverse proxy the same way.
const apiProxy = {
  "/api": {
    target: "http://127.0.0.1:3000",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ""),
  },
  // voice-service (T12) — same same-origin-proxy reasoning as core-api above.
  // WebRTC signaling (`/api/offer`) is a plain HTTP POST, so it proxies fine
  // even though the resulting media itself is a direct peer connection.
  "/voice-api": {
    target: "http://127.0.0.1:8002",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/voice-api/, ""),
  },
  // inference/ (the Lakshmi guidance agent, run via the "inference" workspace's
  // `dev` script on port 8090) - same same-origin-proxy reasoning as above.
  "/guidance-api": {
    target: "http://127.0.0.1:8090",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/guidance-api/, ""),
  },
};

// https://vite.dev/config/
export default defineConfig({
  // Bind to all interfaces, not just loopback - nginx proxies to this dev
  // server from outside its own network namespace/container.
  server: {
    host: "0.0.0.0",
    proxy: apiProxy,
    // Requests arrive with the EC2 public DNS name or the ALB's DNS name as
    // Host (nginx passes it through as-is), which Vite's DNS-rebinding guard
    // otherwise blocks.
    allowedHosts: [
      "ec2-18-205-10-153.compute-1.amazonaws.com",
      "agent-lakshmi-shg-intelligence-161998846.us-east-1.elb.amazonaws.com",
    ],
  },
  preview: {
    host: "0.0.0.0",
    proxy: apiProxy,
    allowedHosts: [
      "ec2-18-205-10-153.compute-1.amazonaws.com",
      "agent-lakshmi-shg-intelligence-161998846.us-east-1.elb.amazonaws.com",
    ],
  },
  plugins: [
    react(),
    VitePWA({
      // Generates the service worker with Workbox and injects the manifest
      // link + registration into index.html automatically.
      registerType: "autoUpdate",
      includeAssets: ["favicon.png"],
      manifest: {
        name: "SHG Smart Market Linkage Platform",
        short_name: "SHG Market",
        description:
          "AI-enabled Smart Market Linkage Platform for Self Help Group products — MEPMA, Andhra Pradesh.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0f766e",
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
