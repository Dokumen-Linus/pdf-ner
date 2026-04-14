// import { fileURLToPath } from "node:url"
import { paraglideVitePlugin } from "@inlang/paraglide-js"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
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
  // resolve: {
  // alias: {
  // "@tanstack/react-store": fileURLToPath(
  // new URL("./node_modules/@tanstack/react-store/dist/esm/index.js", import.meta.url),
  // ),
  // "@tanstack/store": fileURLToPath(
  // new URL("./node_modules/@tanstack/store/dist/esm/index.js", import.meta.url),
  // ),
  // },
  // dedupe: ["@tanstack/react-store", "@tanstack/store"],
  // },
  ssr: {
    noExternal: ["react-tweet"],
  },
})

export default config
