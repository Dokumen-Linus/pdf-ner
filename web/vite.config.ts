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
    tanstackStart(),
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
})

export default config
