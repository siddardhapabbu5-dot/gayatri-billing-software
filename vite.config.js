import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    strictPort: true,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        configure: (proxy) => {
          // Browser → Vite is same-origin; do not forward Origin or Spring treats it as CORS.
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.removeHeader("origin");
            proxyReq.removeHeader("referer");
          });
        },
      },
    },
    watch: {
      // Large MP4s under OneDrive can lock and crash Vite's file watcher (EBUSY).
      ignored: ["**/public/site/images/gallery/videos/**"],
    },
  },
});
