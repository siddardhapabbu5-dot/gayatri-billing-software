import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "strip-crossorigin",
      transformIndexHtml(html) {
        // Same-origin SPA: crossorigin makes the browser send Origin and Spring CORS was 403'ing /assets.
        return html.replace(/\s+crossorigin(?:="[^"]*")?/g, "");
      },
    },
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa/icon-180.png", "site/images/logo-gold.png"],
      manifest: {
        id: "/?mode=public",
        name: "Gayatri Convention",
        short_name: "Gayatri",
        description: "Gayatri Convention — public website (gayatriconvention.com)",
        theme_color: "#102027",
        background_color: "#102027",
        display: "standalone",
        orientation: "any",
        start_url: "/?mode=public#home",
        scope: "/",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "/pwa/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}"],
        // Videos load on demand; never fall back HTML/cache for media.
        navigateFallbackDenylist: [/^\/api/, /\.(?:mp4|webm|mov|m4v)(?:$|\?)/i],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/site/images/") &&
              !/\.(?:mp4|webm|mov|m4v)$/i.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "gayatri-images",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5177,
    strictPort: true,
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
    watch: {
      // Large MP4s under OneDrive can lock and crash Vite's file watcher (EBUSY).
      ignored: ["**/public/site/images/gallery/videos/**"],
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
});
