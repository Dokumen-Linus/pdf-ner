import { useExportCapability } from "@embedpdf/plugin-export/react"
import { useRotateCapability } from "@embedpdf/plugin-rotate/react"
import {
  ArrowLeftRight,
  Download,
  Redo2,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { m } from "@/integrations/paraglide/messages.js"
import usePluginStore from "../plugin-store/hooks/use-plugin-store"
import {
  useActiveDocument,
  useDocumentManagerCapability,
  useOpenDocuments,
} from "./plugin-document-manager-2"
import ToolbarToggleButton from "./toolbar-toggle-button"
import { useZoomCapability } from "./plugin-zoom-2"

interface ToolbarProps {
  canRotate: boolean
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

const Toolbar = ({ canRotate, isSidebarOpen, onToggleSidebar }: ToolbarProps) => {
  const { provides: exportCapability } = useExportCapability()
  const { provides: zoomCapability } = useZoomCapability()
  const { provides: rotateCapability } = useRotateCapability()
  const { provides: documentManagerCapability } = useDocumentManagerCapability()
  const { activeDocumentId } = useActiveDocument()
  const openDocuments = useOpenDocuments()

  const { annoCapability, annoState } = usePluginStore()

  const activeDocumentIndex = openDocuments.findIndex(
    (document) => document.id === activeDocumentId,
  )
  const nextDocument =
    openDocuments.length < 2
      ? null
      : activeDocumentIndex === -1
        ? openDocuments[0]
        : openDocuments[(activeDocumentIndex + 1) % openDocuments.length]

  const handleDelete = () => {
    if (annoState?.selectedUid) {
      annoCapability?.deleteAnnotation(annoState.selectedUid)
    }
  }

  const handleSwitchDocument = () => {
    if (nextDocument) {
      documentManagerCapability?.setActiveDocument(nextDocument.id)
    }
  }

  return (
    <div className="mt-4 mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
      <ToolbarToggleButton isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />

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
        onClick={handleSwitchDocument}
        disabled={!documentManagerCapability || !nextDocument}
        className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
        title={nextDocument?.name ? `Switch to ${nextDocument.name}` : "Switch document"}
      >
        <ArrowLeftRight size={18} />
        <span className="max-w-32 truncate">{nextDocument?.name ?? "Switch"}</span>
      </button>
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
    </div>
  )
}
export default Toolbar
