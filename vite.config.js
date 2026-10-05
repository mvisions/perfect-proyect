import { defineConfig } from "vite";

// Usa rutas relativas para que la compilación funcione en GitHub Pages y Capacitor.
export default defineConfig({
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
    }
  }
});
