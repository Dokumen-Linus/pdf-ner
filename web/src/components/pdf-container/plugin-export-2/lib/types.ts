import { PdfErrorReason, Task } from "@embedpdf/models"

export interface BufferAndName {
  buffer: ArrayBuffer
  name: string
}

// Events include documentId
export interface DownloadRequestEvent {
  documentId: string
}

// Scoped export capability
export interface ExportScope {
  saveAsCopy: () => Task<ArrayBuffer, PdfErrorReason>
  download: () => void
}

export interface ExportCapability {
  // Active document operations
  saveAsCopy: () => Task<ArrayBuffer, PdfErrorReason>
  download: () => void

  // Document-scoped operations
  forDocument(documentId: string): ExportScope
}
