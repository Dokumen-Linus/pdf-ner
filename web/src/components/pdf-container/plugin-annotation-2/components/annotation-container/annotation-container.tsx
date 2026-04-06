import { CSSProperties, JSX, useEffect, useState } from "react"
import { useDoublePressProps } from "../../../../../hooks/mouse-events/use-double-press-props"
import type { PdfTextMarkupAnnotationObject } from "../../lib/types"
import { CounterRotate } from "./counter-rotate"
import { SelectedMenu } from "./selected-menu"

export interface SelectionOutline {
  color?: string
  width?: number
  offset?: number
  style?: "solid" | "dashed" | "dotted"
  borderRadius?: number
}

interface AnnotationContainerProps {
  documentId: string
  scale: number
  rotation: number
  annotation: PdfTextMarkupAnnotationObject
  children: (annotation: PdfTextMarkupAnnotationObject) => JSX.Element | null
  isSelected: boolean
  onDoubleClick?: (event: React.MouseEvent) => void
  onSelect: (event: React.MouseEvent) => void
  selectionOutline?: SelectionOutline
  style?: CSSProperties
}

export function AnnotationContainer({
  documentId,
  scale,
  rotation,
  annotation,
  children,
  isSelected,
  onDoubleClick,
  onSelect,
  selectionOutline,
  style = {},
  ...props
}: AnnotationContainerProps): JSX.Element {
  const outline = {
    width: 1,
    color: "black",
    offset: 0,
    style: "solid" as const,
    ...selectionOutline,
  }

  const [preview, setPreview] = useState<PdfTextMarkupAnnotationObject>(annotation)
  const currentObject = preview ? { ...annotation, ...preview } : annotation

  const doubleProps = useDoublePressProps(onDoubleClick)

  useEffect(() => {
    setPreview(annotation)
  }, [annotation])

  return (
    <div data-no-interaction>
      <div
        {...doubleProps}
        onClick={onSelect}
        style={{
          position: "absolute",
          left: currentObject.rect.origin.x * scale,
          top: currentObject.rect.origin.y * scale,
          width: currentObject.rect.size.width * scale,
          height: currentObject.rect.size.height * scale,
          outline: isSelected
            ? `${outline.width}px ${outline.style ?? "solid"} ${outline.color}`
            : "none",
          outlineOffset: isSelected ? `${outline.offset}px` : "0px",
          borderRadius: outline.borderRadius,
          pointerEvents: isSelected ? "auto" : "none",
          touchAction: "none",
          cursor: "default",
          zIndex: 1,
          ...style,
        }}
        {...props}
      >
        {children(currentObject)}
      </div>
      <CounterRotate
        rect={{
          origin: {
            x: currentObject.rect.origin.x * scale,
            y: currentObject.rect.origin.y * scale,
          },
          size: {
            width: currentObject.rect.size.width * scale,
            height: currentObject.rect.size.height * scale,
          },
        }}
        rotation={rotation}
      >
        {({ rect, menuWrapperProps }) => (
          <SelectedMenu
            documentId={documentId}
            annotation={annotation}
            selected={isSelected}
            rect={rect}
            menuWrapperProps={menuWrapperProps}
          />
        )}
      </CounterRotate>
    </div>
  )
}
