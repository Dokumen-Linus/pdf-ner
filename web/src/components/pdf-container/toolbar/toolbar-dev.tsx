// extended version of Toolbar to add buttons that test functionality but won't be exposed to the user

import { FormEvent, useState } from "react"
import { PdfAnnotationSubtype } from "@embedpdf/models"

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
} from "@/components/icons"
import { Input } from "@/components/shadcn-ui/input"
import { m } from "@/integrations/paraglide/messages.js"

import usePluginStore from "../../plugin-store/hooks/use-plugin-store"
import { useActiveDocument } from "../plugin-document-manager-2"
import { useExportCapability } from "../plugin-export-2"
import { useRotateCapability } from "../plugin-rotate-2"
import { useSearch } from "../plugin-search-2"
import { useZoomCapability } from "../plugin-zoom-2"

import ToolbarToggleButton from "./toolbar-toggle-button"

import "./toolbar-dev.css"

import type { Dispatch, SetStateAction } from "react"
import type { PdfTextMarkupAnnotationObject, Subtype } from "../plugin-annotation-2"

interface ToolbarProps {
  canRotate: boolean
  isSidebarOpen: boolean
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>
}

const Toolbar = ({ canRotate, isSidebarOpen, setIsSidebarOpen }: ToolbarProps) => {
  const { provides: exportCapability } = useExportCapability()
  const { provides: zoomCapability } = useZoomCapability()
  const { provides: rotateCapability } = useRotateCapability()
  const { activeDocumentId } = useActiveDocument()
  const { state: searchState, provides: searchScope } = useSearch(activeDocumentId ?? "")

  const { annoCapability, annoState } = usePluginStore()
  const [searchQuery, setSearchQuery] = useState(searchState.query)

  const handleDelete = () => {
    if (annoState?.selectedUid) {
      annoCapability?.deleteAnnotation(annoState.selectedUid)
    }
  }

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
    <div className="pdf-toolbar">
      <ToolbarToggleButton isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />

      <div className="divider" />

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
          className={tool.subtype === annoState?.activeSubtype ? "active" : ""}
          title={tool.title}
        >
          <tool.icon size={18} />
        </button>
      ))}

      <div className="divider" />

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
          className="primary"
          title="Search PDF text"
        >
          <Search size={18} />
        </button>
        <button
          type="button"
          onClick={() => searchScope?.previousResult()}
          disabled={!searchScope || searchState.total === 0}
          title="Previous result"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => searchScope?.nextResult()}
          disabled={!searchScope || searchState.total === 0}
          title="Next result"
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          onClick={() => searchScope?.setShowAllResults(!searchState.showAllResults)}
          disabled={!searchScope || searchState.total === 0}
          className="text-xs"
          title="Toggle all search highlights"
        >
          {searchState.showAllResults ? "All" : "One"}
        </button>
        <div className="count">
          {searchState.loading
            ? "Searching..."
            : searchState.total > 0
              ? `${searchState.activeResultIndex + 1}/${searchState.total}`
              : "0 results"}
        </div>
      </form>

      <div className="divider" />

      <button
        onClick={() => zoomCapability?.zoomOut()}
        disabled={!zoomCapability}
        className="primary"
        title={m.pdf_toolbar_zoom_out()}
      >
        <ZoomOut size={18} />
      </button>
      <button
        onClick={() => zoomCapability?.zoomIn()}
        disabled={!zoomCapability}
        className="primary"
        title={m.pdf_toolbar_zoom_in()}
      >
        <ZoomIn size={18} />
      </button>

      <div className="divider" />

      <button
        onClick={() => annoCapability?.undo()}
        disabled={!annoState?.canUndo}
        title={m.pdf_toolbar_undo()}
      >
        <Undo2 size={18} />
      </button>
      <button
        onClick={() => annoCapability?.redo()}
        disabled={!annoState?.canRedo}
        title={m.pdf_toolbar_redo()}
      >
        <Redo2 size={18} />
      </button>

      <div className="divider" />
      {canRotate && (
        <>
          <button
            onClick={() => rotateCapability?.rotateBackward()}
            disabled={!rotateCapability}
            className="primary"
            title={m.pdf_toolbar_rotate_ccw()}
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={() => rotateCapability?.rotateForward()}
            disabled={!rotateCapability}
            className="primary"
            title={m.pdf_toolbar_rotate_cw()}
          >
            <RotateCw size={18} />
          </button>
        </>
      )}
      <button
        onClick={() => exportCapability?.download()}
        disabled={!exportCapability}
        className="success"
        title={m.pdf_toolbar_download()}
      >
        <Download size={18} />
      </button>
      <button
        onClick={handleDelete}
        disabled={!annoState?.selectedUid}
        className="danger"
        title={m.pdf_toolbar_delete()}
      >
        <Trash2 size={18} />
      </button>
      <button
        onClick={() => {
          let patch: Partial<PdfTextMarkupAnnotationObject> = {}
          patch.strokeColor = "red"
          patch.opacity = 0.5
          patch.type = PdfAnnotationSubtype.HIGHLIGHT
          if (!annoState || !annoState.activeDocumentId) return
          const docState = annoState.documents[annoState.activeDocumentId]
          if (!docState) return
          const allAnnoUids = Object.keys(docState.byUid)
          annoCapability?.updateAnnotations(allAnnoUids.map((id: string) => ({ id, patch })))
        }}
        className="danger"
        title={m.pdf_toolbar_dev_red_highlights_tooltip()}
      >
        {m.pdf_toolbar_dev_red_highlights_button()}
      </button>
    </div>
  )
}

export default Toolbar
