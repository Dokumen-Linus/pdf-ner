import { FormEvent, startTransition, useEffect, useState } from "react"
import { boundingRect, SearchAllPagesResult, uuidV4 } from "@embedpdf/models"

import { Highlighter, LineSquiggle, Strikethrough, Underline } from "@/components/icons"
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

import type { PluginStore } from "../../plugin-store/hooks/use-plugin-store"
import type { EntityType } from "../entity-type"
import type { EntityTypeStore } from "../hooks/use-entity-type-store"

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
  const pluginStore = usePluginStore()
  const { activeDocumentId, annoState, annoCapability, searchCapability, scrollCapability } =
    pluginStore

  const { byName: entityTypesByName, setByName, patchEntityType } = useEntityTypeStore()

  useEffect(() => {
    setByName(entityTypesToRecord(entityTypes))
  }, [entityTypes, setByName])

  return (
    <EntityTableDocumentRows
      key={activeDocumentId ?? "no-document"}
      activeDocumentId={activeDocumentId}
      annoState={annoState ?? null}
      annoCapability={annoCapability}
      searchCapability={searchCapability}
      scrollCapability={scrollCapability}
      entityTypesByName={entityTypesByName}
      patchEntityType={patchEntityType}
    />
  )
}

function EntityTableDocumentRows({
  activeDocumentId,
  annoState,
  annoCapability,
  searchCapability,
  scrollCapability,
  entityTypesByName,
  patchEntityType,
}: {
  activeDocumentId: PluginStore["activeDocumentId"]
  annoState: PluginStore["annoState"]
  annoCapability: PluginStore["annoCapability"]
  searchCapability: PluginStore["searchCapability"]
  scrollCapability: PluginStore["scrollCapability"]
  entityTypesByName: Record<string, EntityType>
  patchEntityType: EntityTypeStore["patchEntityType"]
}) {
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({})
  const [searchFeedback, setSearchFeedback] = useState<Record<string, string>>({})
  const [searchingEntityName, setSearchingEntityName] = useState<string | null>(null)

  const activeDoc = activeDocumentId ? annoState?.documents[activeDocumentId] : null

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
                    patchEntityType(name, {
                      subtype: value as Subtype,
                    })
                    if (annoState?.activeEntityType === name) {
                      annoCapability?.setCreateAnnotationDefaults({
                        subtype: value as Subtype,
                      })
                    }
                    if (!activeDocumentId) return

                    const currentDocument = annoState?.documents[activeDocumentId] ?? null
                    const annoIds = currentDocument?.byEntityType?.[name] || []
                    annoCapability?.updateAnnotations(
                      annoIds.map((id: string) => ({
                        id,
                        patch: {
                          type: subtypeToEnum(value as Subtype),
                        } as Partial<PdfTextMarkupAnnotationObject>,
                      })),
                      activeDocumentId ?? undefined,
                    )
                  }}
                >
                  <SelectTrigger className="w-17.5 bg-white">
                    <SelectValue placeholder={entityType.subtype} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
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
                    patchEntityType(name, {
                      color,
                    })
                    if (annoState?.activeEntityType === name) {
                      annoCapability?.setCreateAnnotationDefaults({
                        color,
                      })
                    }
                    if (!activeDocumentId) return

                    const currentDocument = annoState?.documents[activeDocumentId] ?? null
                    const annoIds = currentDocument?.byEntityType?.[name] || []
                    annoCapability?.updateAnnotations(
                      annoIds.map((id: string) => ({
                        id,
                        patch: {
                          color,
                        } as Partial<PdfTextMarkupAnnotationObject>,
                      })),
                      activeDocumentId ?? undefined,
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
