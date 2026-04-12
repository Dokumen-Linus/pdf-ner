import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { generateSitemap } from "tanstack-router-sitemap"
import { paraglideVitePlugin } from "@inlang/paraglide-js"
import { defineConfig } from "vite"
import viteTsConfigPaths from "vite-tsconfig-paths"
import { sitemap } from "./src/utils/sitemap"

const config = defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
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
    resolve: {
      conditions: ["react-server"],
    },
  },
})

export default config
