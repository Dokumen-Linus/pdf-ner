import { BasePluginConfig, PluginPackage } from "@embedpdf/core"

import { ExportPlugin } from "./export-plugin"
import { EXPORT_PLUGIN_ID, manifest } from "./manifest"

export const ExportPluginPackage: PluginPackage<ExportPlugin, BasePluginConfig> = {
  manifest,
  create: (registry, config) => new ExportPlugin(EXPORT_PLUGIN_ID, registry, config),
  reducer: () => {},
  initialState: {},
}

export * from "./export-plugin"
export * from "./types"
export * from "./manifest"
