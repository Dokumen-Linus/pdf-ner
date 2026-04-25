import { BasePluginConfig, PluginManifest } from "@embedpdf/core"

export const BOOKMARK_PLUGIN_ID = "bookmark"

export const manifest: PluginManifest<BasePluginConfig> = {
  id: BOOKMARK_PLUGIN_ID,
  name: "Bookmark Plugin",
  version: "1.0.0",
  provides: ["bookmark"],
  requires: [],
  optional: [],
  defaultConfig: {},
}
