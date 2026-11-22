import { defineConfig } from "vite";

export default defineConfig({
  // Relative assets work both locally and below a GitHub Pages project path.
  base: "./",
  server: { host: "127.0.0.1", port: 8017, strictPort: true },
  preview: { host: "127.0.0.1", port: 8017, strictPort: true },
});
