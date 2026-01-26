import type { PluginManifest, PluginPackage } from "@embedpdf/core"
import { reducer, SearchAction } from "./actions"
import { SearchPlugin, SearchPluginConfig } from "./search-plugin"
import { initialState, type SearchState } from "./state"

// ***PLUGIN ID***
export const SEARCH_PLUGIN_ID = "search"

// ***PLUGIN MANIFEST***
export const manifest: PluginManifest<SearchPluginConfig> = {
  id: SEARCH_PLUGIN_ID,
  name: "Search Plugin",
  version: "1.0.0",
  provides: ["search"],
  requires: ["loader"],
  optional: [],
  defaultConfig: {
    enabled: true,
    flags: [],
  },
}

// ***PLUGIN PACKAGE***
export const SearchPluginPackage: PluginPackage<
  SearchPlugin,
  SearchPluginConfig,
  SearchState,
  SearchAction
> = {
  manifest,
  create: (registry, config) => new SearchPlugin(SEARCH_PLUGIN_ID, registry, config),
  reducer,
  initialState,
}
