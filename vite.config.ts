import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
  ],
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    "process.env.NEXT_PUBLIC_CONVEX_URL": JSON.stringify(process.env.NEXT_PUBLIC_CONVEX_URL),
  },
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      // Don't externalize any deps for client build
      input: "./index.html",
    },
  },
  ssr: {
    target: "node",
    // Externalize node modules for SSR
    external: [
      "@tanstack/start",
      "@tanstack/start-storage-context",
      "@sentry/node",
      "@sentry/node-core",
      "@opentelemetry/api",
      "@opentelemetry/context-async-hooks",
      "@opentelemetry/instrumentation-undici",
      "@opentelemetry/instrumentation-fs",
      "@opentelemetry/instrumentation-http",
    ],
  },
  optimizeDeps: {
    exclude: [
      "@tanstack/start",
      "@sentry/node",
    ],
  },
});
