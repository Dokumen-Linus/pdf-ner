import { useCapability } from "@embedpdf/core/react"

import { RotatePlugin } from "../lib"

export const useRotateCapability = () => useCapability<RotatePlugin>(RotatePlugin.id)
