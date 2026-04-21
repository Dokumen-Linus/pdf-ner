import { PdfBookmarkObject, PdfErrorReason, Task } from "@embedpdf/models"

// Scoped bookmark capability for a specific document
export interface BookmarkScope {
  getBookmarks(): Task<{ bookmarks: PdfBookmarkObject[] }, PdfErrorReason>
}

export interface BookmarkCapability {
  // Active document operations
  getBookmarks: () => Task<{ bookmarks: PdfBookmarkObject[] }, PdfErrorReason>

  // Document-scoped operations
  forDocument(documentId: string): BookmarkScope
}
