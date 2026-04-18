import { PluginPackage } from "@embedpdf/core"

import { ThumbnailAction } from "./actions"
import { manifest, THUMBNAIL_PLUGIN_ID } from "./manifest"
import { initialState, thumbnailReducer } from "./reducer"
import { ThumbnailPlugin } from "./thumbnail-plugin"
import { ThumbnailPluginConfig, ThumbnailState } from "./types"

export const ThumbnailPluginPackage: PluginPackage<
  ThumbnailPlugin,
  ThumbnailPluginConfig,
  ThumbnailState,
  ThumbnailAction
> = {
  manifest,
  create: (registry, config) => new ThumbnailPlugin(THUMBNAIL_PLUGIN_ID, registry, config),
  reducer: thumbnailReducer,
  initialState,
}

export * from "./thumbnail-plugin"
export * from "./types"
export * from "./manifest"
export * from "./actions"
export * from "./reducer"
