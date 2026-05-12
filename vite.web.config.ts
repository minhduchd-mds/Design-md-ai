import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "web",
  build: {
    outDir: "../dist-web",
    emptyOutDir: true,
    target: "es2020",
    chunkSizeWarningLimit: 700,
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
  },
});
