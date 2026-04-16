import { useCapability, usePlugin } from "@embedpdf/core/react"
import { TilingPlugin } from "../lib"

export const useTilingPlugin = () => usePlugin<TilingPlugin>(TilingPlugin.id)
export const useTilingCapability = () => useCapability<TilingPlugin>(TilingPlugin.id)
