import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [] } },
  resolve: { dedupe: ["react", "react-dom", "framer-motion"] },
  server: { fs: { allow: [".."] } },
  build: {
    sourcemap: false,
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom/client"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
