// bunx tsx web/src/components/pdf-container/-print-manifests.ts
// not part of app code, helper to generate manifests.json

import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { AnnotationPluginPackage } from "../plugin-annotation-2"
import { DocumentManagerPluginPackage } from "../plugin-document-manager-2"
import { ExportPluginPackage } from "../plugin-export-2"
import { InteractionManagerPluginPackage } from "../plugin-interaction-manager-2"
import { RenderPluginPackage } from "../plugin-render-2"
import { RotatePluginPackage } from "../plugin-rotate-2"
import { ScrollPluginPackage } from "../plugin-scroll-2"
import { SearchPluginPackage } from "../plugin-search-2"
import { SelectionPluginPackage } from "../plugin-selection-2"
import { TilingPluginPackage } from "../plugin-tiling-2"
import { ViewportPluginPackage } from "../plugin-viewport-2"
import { ZoomPluginPackage } from "../plugin-zoom-2"

type PluginManifestShape = {
  name: string
  version: string
  provides: string[]
  requires: string[]
  optional?: string[]
}

type PluginPackageShape = {
  manifest: PluginManifestShape
}

type SerializablePluginManifest = {
  name: string
  version: string
  provides: string[]
  requires: string[]
  optional: string[]
}

const pluginPackages = [
  DocumentManagerPluginPackage,
  ViewportPluginPackage,
  ScrollPluginPackage,
  RenderPluginPackage,
  RotatePluginPackage,
  InteractionManagerPluginPackage,
  TilingPluginPackage,
  SelectionPluginPackage,
  AnnotationPluginPackage,
  ExportPluginPackage,
  ZoomPluginPackage,
  SearchPluginPackage,
] satisfies PluginPackageShape[]

const manifests: SerializablePluginManifest[] = pluginPackages.map(({ manifest }) => ({
  name: manifest.name,
  version: manifest.version,
  provides: manifest.provides,
  requires: manifest.requires,
  optional: manifest.optional ?? [],
}))

const output = `${JSON.stringify(manifests, null, 2)}\n`
const currentDir = dirname(fileURLToPath(import.meta.url))
const outputPath = join(currentDir, "manifests.json")

writeFileSync(outputPath, output, "utf8")
process.stdout.write(output)
