import { FormEvent, startTransition, useEffect, useState } from "react"
import { boundingRect, SearchAllPagesResult, uuidV4 } from "@embedpdf/models"
import { Highlighter, LineSquiggle, Strikethrough, Underline } from "lucide-react"

import {
  PdfTextMarkupAnnotationObject,
  Subtype,
  subtypeToEnum,
} from "@/components/pdf-container/plugin-annotation-2"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn-ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn-ui/table"
import { m } from "@/integrations/paraglide/messages.js"

import ColorPicker from "../../custom/color-picker"
import usePluginStore from "../../plugin-store/hooks/use-plugin-store"
import useEntityTypeStore from "../hooks/use-entity-type-store"

import type { EntityType } from "../entity-type"

function entityTypesToRecord(entityTypes: EntityType[]) {
  return Object.fromEntries(entityTypes.map((entityType) => [entityType.name, entityType]))
}

function createAnnotationFromSearchResult(
  entityType: EntityType,
  entityTypeName: string,
  result: SearchAllPagesResult["results"][number],
) {
  const rect = boundingRect(result.rects)
  if (!rect) return null

  return {
    type: subtypeToEnum(entityType.subtype),
    color: entityType.color,
    opacity: entityType.opacity,
    rect,
    segmentRects: result.rects,
    pageIndex: result.pageIndex,
    id: uuidV4(),
    contents: result.context.match,
    custom: {
      entityType: entityTypeName,
    },
  } as PdfTextMarkupAnnotationObject
}

const EntityTable = ({ entityTypes }: { entityTypes: EntityType[] }) => {
  // annoState contains the whole AnnotationState
  // annoState?.byEntityType gives ET name -> array of UIDs of annotations
  // annoState?.byUid[uid].contents - text of annotation
  const { annoState, annoCapability, searchCapability, scrollCapability } = usePluginStore()

  // entityTypesByName is a record of name -> EntityType
  const { byName: entityTypesByName, setByName, patchEntityType } = useEntityTypeStore()
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({})
  const [searchFeedback, setSearchFeedback] = useState<Record<string, string>>({})
  const [searchingEntityName, setSearchingEntityName] = useState<string | null>(null)

  // Sync the table with the entity types provided by the page.
  useEffect(() => {
    setByName(entityTypesToRecord(entityTypes))
  }, [entityTypes, setByName])

  // example usage of entityTypesByName
  // const entityTypeObject1 = entityTypesByName["Highlight"] as EntityType
  // const entityTypeNames: string[] = Object.keys(entityTypesByName)

  // uses annoCapability to set the default attributes for an annotation that the user creates
  const activateEntityType = (entityTypeName: string) => {
    const entityType = entityTypesByName[entityTypeName]
    if (!entityType) return
    annoCapability?.setCreateAnnotationDefaults({
      entityType: entityType.name,
      subtype: entityType.subtype,
      color: entityType.color,
      opacity: entityType.opacity,
    })
  }

  const activeDocumentId = annoState?.activeDocumentId ?? null
  const activeDoc = activeDocumentId ? annoState?.documents[activeDocumentId] : null

  const focusEntityType = (entityTypeName: string) => {
    activateEntityType(entityTypeName)

    if (!activeDocumentId) return

    const annotationId = activeDoc?.byEntityType?.[entityTypeName]?.[0]
    const annotation = annotationId ? activeDoc?.byUid?.[annotationId] : null
    if (!annotation) return

    annoCapability?.selectAnnotation(annotation.id)
    scrollCapability?.forDocument(activeDocumentId).scrollToPage({
      pageNumber: annotation.pageIndex + 1,
      pageCoordinates: {
        x: annotation.rect.origin.x + annotation.rect.size.width / 2,
        y: annotation.rect.origin.y + annotation.rect.size.height / 2,
      },
      alignX: 50,
      alignY: 50,
      behavior: "smooth",
    })
  }

  const setFeedback = (entityTypeName: string, value: string) => {
    startTransition(() => {
      setSearchFeedback((current) => ({
        ...current,
        [entityTypeName]: value,
      }))
    })
  }

  const handleSearchCreate = async (entityTypeName: string, event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()

    const entityType = entityTypesByName[entityTypeName]
    const query = searchQueries[entityTypeName]?.trim() ?? ""

    activateEntityType(entityTypeName)

    if (!entityType || !activeDocumentId || !annoCapability || !searchCapability) {
      setFeedback(entityTypeName, "Search is not ready yet.")
      return
    }

    if (!query) {
      setFeedback(entityTypeName, "Enter text to search for.")
      return
    }

    setSearchingEntityName(entityTypeName)
    setFeedback(entityTypeName, "")

    try {
      const searchScope = searchCapability.forDocument(activeDocumentId)
      const result = await new Promise<SearchAllPagesResult>((resolve, reject) => {
        searchScope.searchAllPages(query).wait(resolve, reject)
      })

      const firstMatch = result.results[0]
      if (!firstMatch) {
        setFeedback(entityTypeName, `No matches found for "${query}".`)
        return
      }

      const annotation = createAnnotationFromSearchResult(entityType, entityTypeName, firstMatch)
      if (!annotation) {
        setFeedback(entityTypeName, "Could not create an annotation from that match.")
        return
      }

      const existingAnnotationIds = activeDoc?.byEntityType?.[entityTypeName] || []
      if (entityType.unique && existingAnnotationIds.length > 0) {
        annoCapability.deleteAnnotations(existingAnnotationIds, activeDocumentId)
      }

      annoCapability.createAnnotation(annotation, activeDocumentId)
      searchScope.setShowAllResults(false)
      searchScope.goToResult(0)
      scrollCapability
        ?.forDocument(activeDocumentId)
        .scrollToPage({ pageNumber: firstMatch.pageIndex + 1, behavior: "smooth", alignY: 15 })

      setFeedback(entityTypeName, `Assigned the first match for "${query}".`)
    } catch {
      setFeedback(entityTypeName, "Search failed. Try selecting text instead.")
    } finally {
      setSearchingEntityName((current) => (current === entityTypeName ? null : current))
    }
  }

  return (
    <Table className="[&_td]:px-1.5 [&_td]:py-2 [&_th]:px-1.5 [&_th]:py-2.5">
      <TableHeader>
        <TableRow>
          <TableHead>{m.entity_table_col_subtype()}</TableHead>
          <TableHead>{m.entity_table_col_color()}</TableHead>
          <TableHead>{m.entity_table_col_name()}</TableHead>
          <TableHead>{m.entity_table_col_value()}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(entityTypesByName).map(([name, entityType]) => {
          const annotationUids = activeDoc?.byEntityType?.[name] || []
          const firstUid = annotationUids[0]
          const annotation = firstUid ? activeDoc?.byUid?.[firstUid] : null
          const annotationText = annotation?.contents || ""
          const isActive = annoState?.activeEntityType === name
          const feedback = searchFeedback[name]
          const isSearching = searchingEntityName === name

          return (
            <TableRow key={name}>
              <TableCell>
                <Select
                  value={entityType.subtype}
                  onValueChange={(value) => {
                    // change EntityTypeStore so next activation will use new subtype
                    patchEntityType(name, {
                      subtype: value as Subtype,
                    })
                    // change PluginStore so activeSubtype matches the change if deactiveSubtypeAfterCreate is false
                    if (annoState?.activeEntityType === name) {
                      annoCapability?.setCreateAnnotationDefaults({
                        subtype: value as Subtype,
                      })
                    }
                    // use PluginStore to change existing annotations of this ET
                    const activeDoc = annoState?.activeDocumentId
                      ? annoState.documents[annoState.activeDocumentId]
                      : null
                    const annoIds = activeDoc?.byEntityType?.[name] || []
                    annoCapability?.updateAnnotations(
                      annoIds.map((id) => ({
                        id,
                        patch: {
                          type: subtypeToEnum(value as Subtype),
                        } as Partial<PdfTextMarkupAnnotationObject>,
                      })),
                    )
                  }}
                >
                  <SelectTrigger className="w-17.5">
                    <SelectValue placeholder={entityType.subtype} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="highlight">
                      <Highlighter className="w-10" />
                    </SelectItem>
                    <SelectItem value="underline">
                      <Underline className="h-4 w-4" />
                    </SelectItem>
                    <SelectItem value="squiggly">
                      <LineSquiggle className="h-4 w-4" />
                    </SelectItem>
                    <SelectItem value="strikeout">
                      <Strikethrough className="h-4 w-4" />
                    </SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <ColorPicker
                  value={entityType.color}
                  onChange={(color) => {
                    // change EntityTypeStore so next ET activation will use new color
                    patchEntityType(name, {
                      color,
                    })
                    // change PluginStore so activeColor matches the change
                    if (annoState?.activeEntityType === name) {
                      annoCapability?.setCreateAnnotationDefaults({
                        color,
                      })
                    }
                    // use PluginStore to change existing annotations of this ET
                    const activeDoc = annoState?.activeDocumentId
                      ? annoState.documents[annoState.activeDocumentId]
                      : null
                    const annoIds = activeDoc?.byEntityType?.[name] || []
                    annoCapability?.updateAnnotations(
                      annoIds.map((id) => ({
                        id,
                        patch: {
                          color,
                        } as Partial<PdfTextMarkupAnnotationObject>,
                      })),
                    )
                  }}
                />
              </TableCell>
              <TableCell className="cursor-pointer" onClick={() => focusEntityType(name)}>
                {name}
              </TableCell>
              <TableCell
                className="cursor-pointer"
                onClick={() => {
                  focusEntityType(name)
                }}
              >
                {isActive ? (
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="text-muted-foreground text-xs">Search or select text</div>
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(event) => {
                        void handleSearchCreate(name, event)
                      }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Input
                        value={searchQueries[name] ?? ""}
                        placeholder="Find text in the PDF"
                        className="h-8"
                        onChange={(event) => {
                          const value = event.target.value
                          setSearchQueries((current) => ({
                            ...current,
                            [name]: value,
                          }))
                        }}
                        onClick={(event) => event.stopPropagation()}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={isSearching}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {isSearching ? "Searching..." : "Search"}
                      </Button>
                    </form>
                    <div className="text-muted-foreground text-xs">
                      {feedback || "Or drag-select text directly in the PDF."}
                    </div>
                    {annotationText ? (
                      <div className="truncate text-xs">{annotationText}</div>
                    ) : null}
                  </div>
                ) : (
                  annotationText || m.entity_table_state_empty()
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
export default EntityTable
