import { BasePluginConfig, PluginManifest } from "@embedpdf/core"

export const EXPORT_PLUGIN_ID = "export"

export const manifest: PluginManifest<BasePluginConfig> = {
  id: EXPORT_PLUGIN_ID,
  name: "Export Plugin",
  version: "1.0.0",
  provides: ["export"],
  requires: [],
  optional: [],
  defaultConfig: {
    defaultFileName: "document.pdf",
  },
}
