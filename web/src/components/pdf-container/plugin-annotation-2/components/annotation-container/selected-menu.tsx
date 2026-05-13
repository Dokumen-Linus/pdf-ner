import { useMemo } from "react"
import { Rect } from "@embedpdf/models"
import { Trash2 } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn-ui/select"

import { useAnnotationCapability } from "../../hooks"
import { subtypeToEnum } from "../../lib/types"

import type { PdfTextMarkupAnnotationObject } from "../../lib/types"
import type { MenuWrapperProps } from "./counter-rotate"

interface SelectedMenuProps {
  documentId: string
  annotation: PdfTextMarkupAnnotationObject
  selected: boolean
  rect: Rect
  menuWrapperProps: MenuWrapperProps
}

const EMPTY_ENTITY_TYPES: import("@/components/entity-table/entity-type").EntityType[] = []

export const SelectedMenu = ({
  documentId,
  annotation,
  menuWrapperProps,
  selected,
  rect,
}: SelectedMenuProps) => {
  const { provides: annotationCapability } = useAnnotationCapability()

  const allEntityTypes = annotationCapability?.getAllEntityTypes() ?? EMPTY_ENTITY_TYPES

  const currentEntityType =
    (annotation.custom as { entityType?: string } | undefined)?.entityType ?? ""

  const entityTypesByName = useMemo(
    () => Object.fromEntries(allEntityTypes.map((et) => [et.name, et])),
    [allEntityTypes],
  )

  if (!selected) return null

  const handleEntityTypeChange = (next: string) => {
    const targetEntityType = entityTypesByName[next]
    if (!targetEntityType) return

    annotationCapability?.updateAnnotation(
      annotation.id,
      {
        type: subtypeToEnum(targetEntityType.subtype) as PdfTextMarkupAnnotationObject["type"],
        color: targetEntityType.color,
        opacity: targetEntityType.opacity,
        custom: { ...(annotation.custom ?? {}), entityType: next },
      },
      documentId,
    )
  }

  return (
    <div {...menuWrapperProps}>
      <div
        className="flex flex-row items-center gap-1 rounded-md border border-[#cfd4da] bg-white p-1 shadow-md"
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
        <Select value={currentEntityType} onValueChange={handleEntityTypeChange}>
          <SelectTrigger size="sm" className="h-8 min-w-32">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {allEntityTypes.map((entityType) => {
              const annoState = annotationCapability?.getState()
              const docState = annoState?.documents?.[documentId]
              const isUniqueAndAssigned =
                entityType.unique &&
                currentEntityType !== entityType.name &&
                (docState?.byEntityType?.[entityType.name]?.length ?? 0) > 0

              return (
                <SelectItem
                  key={entityType.name}
                  value={entityType.name}
                  disabled={isUniqueAndAssigned}
                  className={isUniqueAndAssigned ? "text-gray-300" : ""}
                >
                  {entityType.name}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
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
