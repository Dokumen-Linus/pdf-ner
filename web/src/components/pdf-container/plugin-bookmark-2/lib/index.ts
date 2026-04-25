import { BasePluginConfig, PluginPackage } from "@embedpdf/core"

import { BookmarkPlugin } from "./bookmark-plugin"
import { BOOKMARK_PLUGIN_ID, manifest } from "./manifest"

export const BookmarkPluginPackage: PluginPackage<BookmarkPlugin, BasePluginConfig> = {
  manifest,
  create: (registry) => new BookmarkPlugin(BOOKMARK_PLUGIN_ID, registry),
  reducer: () => {},
  initialState: {},
}

export * from "./bookmark-plugin"
export * from "./types"
export * from "./manifest"
