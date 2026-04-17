import { FormEvent, useEffect, useState } from "react"
import { PdfAnnotationSubtype } from "@embedpdf/models"
import { useExportCapability } from "@embedpdf/plugin-export/react"
import { useRotateCapability } from "@embedpdf/plugin-rotate/react"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Highlighter,
  Redo2,
  RotateCcw,
  RotateCw,
  Search,
  Trash2,
  Underline,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Input } from "@/components/shadcn-ui/input"
import { m } from "@/integrations/paraglide/messages.js"
import usePluginStore from "../../plugin-store/hooks/use-plugin-store"
import type { PdfTextMarkupAnnotationObject, Subtype } from "../plugin-annotation-2"
import { useActiveDocument } from "../plugin-document-manager-2"
import { useSearch } from "../plugin-search-2"
import { useZoomCapability } from "../plugin-zoom-2"

const Toolbar = ({ canRotate }: { canRotate: boolean }) => {
  const { provides: exportCapability } = useExportCapability()
  const { provides: zoomCapability } = useZoomCapability()
  const { provides: rotateCapability } = useRotateCapability()
  const { activeDocumentId } = useActiveDocument()
  const { state: searchState, provides: searchScope } = useSearch(activeDocumentId ?? "")

  const { annoCapability, annoState } = usePluginStore()
  const [searchQuery, setSearchQuery] = useState("")

  const handleDelete = () => {
    if (annoState?.selectedUid) {
      annoCapability?.deleteAnnotation(annoState.selectedUid)
    }
  }

  useEffect(() => {
    setSearchQuery(searchState.query)
  }, [searchState.query])

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!searchScope) return
    searchScope.setShowAllResults(false)
    searchScope.startSearch()
    searchScope.searchAllPages(searchQuery)
  }

  const tools = [
    {
      id: "highlight",
      subtype: "highlight" as Subtype,
      icon: Highlighter,
      opacity: 0.5,
      color: "#FBB338",
      title: m.pdf_toolbar_dev_highlight(),
    },
    {
      id: "underline",
      subtype: "underline" as Subtype,
      icon: Underline,
      opacity: 1,
      color: "#F51F1F",
      title: m.pdf_toolbar_dev_underline(),
    },
  ]

  return (
    <div className="mt-4 mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => {
            if (annoState?.activeSubtype !== tool.subtype) {
              annoCapability?.setCreateAnnotationDefaults({
                subtype: tool.subtype,
                opacity: tool.opacity,
                color: tool.color,
              })
            } else {
              annoCapability?.setCreateAnnotationDefaults({
                subtype: null,
              })
            }
          }}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            tool.subtype === annoState?.activeSubtype
              ? "bg-blue-500 text-white"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
          title={tool.title}
        >
          <tool.icon size={18} />
        </button>
      ))}

      <div className="h-6 w-px bg-gray-200" />

      <form className="flex items-center gap-2" onSubmit={handleSearchSubmit}>
        <Input
          value={searchQuery}
          placeholder="Search PDF text"
          className="h-8 w-52"
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <button
          type="submit"
          disabled={!searchScope || searchState.loading}
          className="rounded-md bg-gray-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-300"
          title="Search PDF text"
        >
          <Search size={18} />
        </button>
        <button
          type="button"
          onClick={() => searchScope?.previousResult()}
          disabled={!searchScope || searchState.total === 0}
          className="rounded-md bg-gray-100 px-3 py-1 text-sm font-medium transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          title="Previous result"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => searchScope?.nextResult()}
          disabled={!searchScope || searchState.total === 0}
          className="rounded-md bg-gray-100 px-3 py-1 text-sm font-medium transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          title="Next result"
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          onClick={() => searchScope?.setShowAllResults(!searchState.showAllResults)}
          disabled={!searchScope || searchState.total === 0}
          className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          title="Toggle all search highlights"
        >
          {searchState.showAllResults ? "All" : "One"}
        </button>
        <div className="min-w-18 text-xs text-gray-600">
          {searchState.loading
            ? "Searching..."
            : searchState.total > 0
              ? `${searchState.activeResultIndex + 1}/${searchState.total}`
              : "0 results"}
        </div>
      </form>

      <div className="h-6 w-px bg-gray-200" />

      <button
        onClick={() => zoomCapability?.zoomOut()}
        disabled={!zoomCapability}
        className="rounded-md bg-gray-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-300"
        title={m.pdf_toolbar_zoom_out()}
      >
        <ZoomOut size={18} />
      </button>
      <button
        onClick={() => zoomCapability?.zoomIn()}
        disabled={!zoomCapability}
        className="rounded-md bg-gray-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-300"
        title={m.pdf_toolbar_zoom_in()}
      >
        <ZoomIn size={18} />
      </button>

      <div className="h-6 w-px bg-gray-200" />

      <button
        onClick={() => annoCapability?.undo()}
        disabled={!annoState?.canUndo}
        className="rounded-md bg-gray-100 px-3 py-1 text-sm font-medium transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        title={m.pdf_toolbar_undo()}
      >
        <Undo2 size={18} />
      </button>
      <button
        onClick={() => annoCapability?.redo()}
        disabled={!annoState?.canRedo}
        className="rounded-md bg-gray-100 px-3 py-1 text-sm font-medium transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        title={m.pdf_toolbar_redo()}
      >
        <Redo2 size={18} />
      </button>

      <div className="h-6 w-px bg-gray-200" />
      {canRotate && (
        <>
          <button
            onClick={() => rotateCapability?.rotateBackward()}
            disabled={!rotateCapability}
            className="rounded-md bg-gray-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            title={m.pdf_toolbar_rotate_ccw()}
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={() => rotateCapability?.rotateForward()}
            disabled={!rotateCapability}
            className="rounded-md bg-gray-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            title={m.pdf_toolbar_rotate_cw()}
          >
            <RotateCw size={18} />
          </button>
        </>
      )}
      <button
        onClick={() => exportCapability?.download()}
        disabled={!exportCapability}
        className="rounded-md bg-green-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-green-300"
        title={m.pdf_toolbar_download()}
      >
        <Download size={18} />
      </button>
      <button
        onClick={handleDelete}
        disabled={!annoState?.selectedUid}
        className="rounded-md bg-red-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
        title={m.pdf_toolbar_delete()}
      >
        <Trash2 size={18} />
      </button>
      <button
        onClick={() => {
          let patch: Partial<PdfTextMarkupAnnotationObject> = {}
          patch.color = "red"
          patch.opacity = 0.5
          patch.type = PdfAnnotationSubtype.HIGHLIGHT
          if (!annoState || !annoState.activeDocumentId) return
          const docState = annoState.documents[annoState.activeDocumentId]
          if (!docState) return
          const allAnnoUids = Object.keys(docState.byUid)
          annoCapability?.updateAnnotations(allAnnoUids.map((id: string) => ({ id, patch })))
        }}
        className="rounded-md bg-red-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
        title={m.pdf_toolbar_dev_red_highlights_tooltip()}
      >
        {m.pdf_toolbar_dev_red_highlights_button()}
      </button>
    </div>
  )
}
export default Toolbar
