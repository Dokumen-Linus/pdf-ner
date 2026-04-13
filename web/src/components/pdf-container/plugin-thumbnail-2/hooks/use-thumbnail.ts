import { useCapability, usePlugin } from "@embedpdf/core/react"
import { ThumbnailPlugin } from "../lib"

export const useThumbnailPlugin = () => usePlugin<ThumbnailPlugin>(ThumbnailPlugin.id)
export const useThumbnailCapability = () => useCapability<ThumbnailPlugin>(ThumbnailPlugin.id)
