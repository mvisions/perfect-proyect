import { defineConfig } from "vite";

// Relative base so the build works both on GitHub Pages (served from a subpath)
// and inside the Capacitor WebView (served from the app root).
export default defineConfig({
  base: "./"
});
