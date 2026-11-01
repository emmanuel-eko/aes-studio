import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 43123,
    strictPort: true,
    allowedHosts: [".cursorvm.com", ".localhost", "127.0.0.1"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:48180",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 43123,
    allowedHosts: [".cursorvm.com"],
  },
});
