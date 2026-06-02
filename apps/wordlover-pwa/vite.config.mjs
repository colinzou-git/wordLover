import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: false,
  build: {
    emptyOutDir: false,
    outDir: "public",
    rollupOptions: {
      input: {
        app: "public/app.js",
        "automated-tests": "public/automated-tests.js",
      },
      output: {
        entryFileNames: "assets/[name].bundle.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
