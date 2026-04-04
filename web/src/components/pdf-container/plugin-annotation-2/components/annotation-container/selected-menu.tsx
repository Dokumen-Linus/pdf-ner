import { Rect } from "@embedpdf/models"
import { Trash2 } from "lucide-react"
import { useAnnotationCapability } from "../../hooks"
import type { PdfTextMarkupAnnotationObject } from "../../lib/types"
import type { MenuWrapperProps } from "./counter-rotate"

interface SelectedMenuProps {
  documentId: string
  annotation: PdfTextMarkupAnnotationObject
  selected: boolean
  rect: Rect
  menuWrapperProps: MenuWrapperProps
}

export const SelectedMenu = ({
  documentId,
  annotation,
  menuWrapperProps,
  selected,
  rect,
}: SelectedMenuProps) => {
  const { provides: annotationCapability } = useAnnotationCapability()

  if (!selected) return null

  return (
    <div {...menuWrapperProps}>
      <div
        className="flex flex-row gap-1 rounded-md border border-[#cfd4da] bg-[#f8f9fa] p-1 shadow-sm"
        style={{
          pointerEvents: "auto",
          position: "absolute",
          top: rect.size.height,
          left: rect.size.width / 2,
          transform: "translateX(-50%)",
          marginTop: "3px",
          zIndex: 2,
        }}
      >
        <button
          onClick={() => {
            annotationCapability?.deleteAnnotation(annotation.id, documentId)
          }}
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-200"
          title="Delete"
        >
          <Trash2 size={20} />
        </button>
      </div>
    </div>
  )
}
