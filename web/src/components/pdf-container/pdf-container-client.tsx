import { lazy, Suspense } from "react"
import { ClientOnly } from "@tanstack/react-router"
import PDFLoading from "./pdf-loading"
import type { InitialDocumentOptions } from "./plugin-document-manager-2"

const LazyPDFContainer = lazy(() => import("./pdf-container"))

interface PDFContainerClientProps {
  initalDocuments: InitialDocumentOptions[]
  author?: string
  exportName?: string
  canRotate?: boolean
}

export default function PDFContainerClient(props: PDFContainerClientProps) {
  return (
    <ClientOnly fallback={<PDFLoading />}>
      <Suspense fallback={<PDFLoading />}>
        <LazyPDFContainer {...props} />
      </Suspense>
    </ClientOnly>
  )
}
