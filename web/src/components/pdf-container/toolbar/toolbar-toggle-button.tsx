import { PanelLeftIcon } from "lucide-react"

import { m } from "@/integrations/paraglide/messages.js"

import type { Dispatch, SetStateAction } from "react"

interface ToolbarToggleButtonProps {
  isSidebarOpen: boolean
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>
}

export default function ToolbarToggleButton({
  isSidebarOpen,
  setIsSidebarOpen,
}: ToolbarToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        setIsSidebarOpen((open) => !open)
      }}
      className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
        isSidebarOpen ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-100 hover:bg-gray-200"
      }`}
      title={m.pdf_toolbar_toggle_thumbnails()}
      aria-label={m.pdf_toolbar_toggle_thumbnails()}
      aria-pressed={isSidebarOpen}
    >
      <PanelLeftIcon size={18} />
    </button>
  )
}
