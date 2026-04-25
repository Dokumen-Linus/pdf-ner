import { PdfBookmarkObject, PdfErrorReason, Task } from "@embedpdf/models"

// Scoped bookmark capability for a specific document
export interface BookmarkScope {
  getBookmarks(): Task<{ bookmarks: PdfBookmarkObject[] }, PdfErrorReason>
  setBookmarks(bookmarks: PdfBookmarkObject[]): Task<boolean, PdfErrorReason>
  addBookmarks(bookmarks: PdfBookmarkObject[]): Promise<boolean>
}

export interface BookmarkCapability {
  // Active document operations
  getBookmarks: () => Task<{ bookmarks: PdfBookmarkObject[] }, PdfErrorReason>
  setBookmarks: (bookmarks: PdfBookmarkObject[]) => Task<boolean, PdfErrorReason>
  addBookmarks: (bookmarks: PdfBookmarkObject[]) => Promise<boolean>

  // Document-scoped operations
  forDocument(documentId: string): BookmarkScope
}
