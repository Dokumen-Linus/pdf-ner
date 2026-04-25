import { useCapability, usePlugin } from "@embedpdf/core/react"

import { RotatePlugin } from "../lib"

export const useRotatePlugin = () => usePlugin<RotatePlugin>(RotatePlugin.id)
export const useRotateCapability = () => useCapability<RotatePlugin>(RotatePlugin.id)
