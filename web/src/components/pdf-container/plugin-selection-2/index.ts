import { createPluginPackage } from "@embedpdf/core"
import { CopyToClipboard } from "./components"
import { SelectionPluginPackage as BaseSelectionPluginPackage } from "./lib"

export * from "./hooks"
export * from "./components"
export * from "./lib"

export const SelectionPluginPackage = createPluginPackage(BaseSelectionPluginPackage)
  .addUtility(CopyToClipboard)
  .build()
