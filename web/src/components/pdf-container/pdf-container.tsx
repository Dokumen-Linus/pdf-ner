import { useRef } from "react"
import { createPluginRegistration } from "@embedpdf/core"
import { EmbedPDF } from "@embedpdf/core/react"
import { usePdfiumEngine } from "@embedpdf/engines/react"
import { AllLogger, ConsoleLogger, PerfLogger } from "@embedpdf/models"
import { ExportPluginPackage } from "@embedpdf/plugin-export/react"
import { RotatePluginPackage } from "@embedpdf/plugin-rotate/react"
import { RenderLayer, RenderPluginPackage } from "./plugin-render-2"
import { TilingLayer, TilingPluginPackage } from "./plugin-tiling-2"
import { Viewport, ViewportPluginPackage } from "./plugin-viewport-2"
// import { env } from "../../env.client"
import PluginStoreSync from "../plugin-store/components/plugin-store-sync"
// import Toolbar from "./dev/toolbar-dev"
import PDFLoading from "./pdf-loading"
import { AnnotationLayer, AnnotationPluginPackage } from "./plugin-annotation-2"
import {
  DocumentContent,
  DocumentManagerPluginPackage,
  InitialDocumentOptions,
} from "./plugin-document-manager-2"
import {
  GlobalPointerProvider,
  InteractionManagerPluginPackage,
  PagePointerProvider,
} from "./plugin-interaction-manager-2"
import { Scroller, ScrollPluginPackage, ScrollStrategy } from "./plugin-scroll-2"
import { SearchLayer, SearchPluginPackage } from "./plugin-search-2"
import { SelectionPluginPackage, TextSelection } from "./plugin-selection-2"
import { ZoomGestureWrapper, ZoomMode, ZoomPluginPackage } from "./plugin-zoom-2"
import RotateWrapper from "./rotate-wrapper"
import Toolbar from "./toolbar"

interface PDFContainerProps {
  initalDocuments: InitialDocumentOptions[]
  author?: string
  exportName?: string
  canRotate?: boolean
}

const logger = new AllLogger([new ConsoleLogger(), new PerfLogger()])

export default function PDFContainer({
  initalDocuments,
  author = "anonymous",
  exportName = "labeled.pdf",
  canRotate = true,
}: PDFContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { engine, isLoading } = usePdfiumEngine({
    worker: true,
    logger: logger,
  })

  if (isLoading || !engine) {
    // return <h1>engine loading</h1>
    return <PDFLoading />
  }

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden" ref={containerRef}>
      <div className="flex flex-1 overflow-hidden">
        <EmbedPDF
          config={{
            logger: logger,
            permissions: { enforceDocumentPermissions: false }, // disable permissions set in PDF metadata
          }}
          engine={engine}
          plugins={[
            // need to register DocumentManager first
            createPluginRegistration(DocumentManagerPluginPackage, {
              initialDocuments: initalDocuments,
            }),
            createPluginRegistration(ViewportPluginPackage, {
              viewportGap: 5,
            }),
            // need to  register Scroll after DocumentManager, Viewport
            createPluginRegistration(ScrollPluginPackage, {
              defaultStrategy: ScrollStrategy.Vertical,
            }),
            createPluginRegistration(RenderPluginPackage),
            // need to register Rotate even when canRotate is false
            createPluginRegistration(RotatePluginPackage),
            createPluginRegistration(InteractionManagerPluginPackage),
            createPluginRegistration(TilingPluginPackage, {
              tileSize: 768,
              overlapPx: 2.5,
              extraRings: 0,
            }),
            createPluginRegistration(SelectionPluginPackage),
            // need to register Annotation after InteractionManager, Seletion
            createPluginRegistration(AnnotationPluginPackage, { author }),
            // need to register Export after Annotation
            createPluginRegistration(ExportPluginPackage, {
              defaultFileName: exportName,
            }),
            // need to register Zoom after InteractionManager, Viewport, Scroll
            createPluginRegistration(ZoomPluginPackage, {
              defaultZoomLevel: ZoomMode.Automatic,
            }),
            // need to register Search after Scroll, Selection
            createPluginRegistration(SearchPluginPackage),
          ]}
        >
          {({ pluginsReady, activeDocumentId }) =>
            pluginsReady ? (
              activeDocumentId ? (
                <DocumentContent documentId={activeDocumentId}>
                  {({ isLoaded }) =>
                    isLoaded ? (
                      <GlobalPointerProvider documentId={activeDocumentId}>
                        <PluginStoreSync />
                        <Toolbar canRotate={canRotate} />
                        <Viewport
                          documentId={activeDocumentId}
                          className="h-full w-full flex-1 overflow-hidden bg-gray-100 select-none"
                        >
                          <ZoomGestureWrapper documentId={activeDocumentId}>
                            <Scroller
                              documentId={activeDocumentId}
                              renderPage={({ pageIndex }) => (
                                <RotateWrapper
                                  enabled={canRotate}
                                  documentId={activeDocumentId}
                                  pageIndex={pageIndex}
                                  style={{ backgroundColor: "#fff" }}
                                >
                                  <PagePointerProvider
                                    documentId={activeDocumentId}
                                    pageIndex={pageIndex}
                                  >
                                    {/* RenderLayer must go first */}
                                    <RenderLayer
                                      documentId={activeDocumentId}
                                      pageIndex={pageIndex}
                                      style={{ pointerEvents: "none" }}
                                    />
                                    <TilingLayer
                                      documentId={activeDocumentId}
                                      pageIndex={pageIndex}
                                      style={{ pointerEvents: "none" }}
                                    />
                                    <TextSelection
                                      documentId={activeDocumentId}
                                      pageIndex={pageIndex}
                                    />
                                    <AnnotationLayer
                                      documentId={activeDocumentId}
                                      pageIndex={pageIndex}
                                    />
                                    <SearchLayer
                                      documentId={activeDocumentId}
                                      pageIndex={pageIndex}
                                      highlightColor={"#FFFF00"}
                                      activeHighlightColor={"#FFFF00"}
                                    />
                                  </PagePointerProvider>
                                </RotateWrapper>
                              )}
                            />
                          </ZoomGestureWrapper>
                        </Viewport>
                      </GlobalPointerProvider>
                    ) : (
                      // <h1>DocumentContent loading</h1>
                      <PDFLoading />
                    )
                  }
                </DocumentContent>
              ) : (
                // <h1>activeDocumentId loading</h1>
                <PDFLoading />
              )
            ) : (
              // <h1>pluginsReady loading</h1>
              <PDFLoading />
            )
          }
        </EmbedPDF>
      </div>
    </div>
  )
}
