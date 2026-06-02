import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { paraglideVitePlugin } from "@inlang/paraglide-js"
import tailwindcss from "@tailwindcss/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { generateSitemap } from "tanstack-router-sitemap"
import { defineConfig } from "vite"
import viteTsConfigPaths from "vite-tsconfig-paths"

import { sitemap } from "./src/integrations/sitemap"

const config = defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart({
      server: {
        build: {
          inlineCss: true,
        },
      },
    }),
    nitro(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/integrations/paraglide",
    }),
    generateSitemap(sitemap),
    viteReact({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ],
  ssr: {
    noExternal: ["react-tweet"],
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return
        warn(warning)
      },
    },
  },
})

export default config
