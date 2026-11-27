import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isPages = process.env["GITHUB_PAGES"] === "true";
const pagesBase = process.env["GITHUB_PAGES_BASE"] || "/SupplySync";

export default defineConfig({
  ...(isPages ? { vite: { base: `${pagesBase}/` } } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(isPages
      ? {
          router: { basepath: pagesBase },
          spa: { enabled: true },
        }
      : {}),
  },
});
