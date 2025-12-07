import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import { TanStackStartVitePlugin } from "@tanstack/start/vite-plugin";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    TanStackStartVitePlugin(),
    TanStackRouterVite(),
    react(),
  ],
  define: {
    "process.env": "import.meta.env",
  },
  server: {
    port: 3000,
  },
  ssr: {
    target: "node",
  },
});
