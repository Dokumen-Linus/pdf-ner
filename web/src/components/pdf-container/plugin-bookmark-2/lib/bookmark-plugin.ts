import { BasePlugin, BasePluginConfig, PluginRegistry } from "@embedpdf/core"
import { PdfBookmarkObject, PdfErrorReason, Task } from "@embedpdf/models"

import { BookmarkCapability, BookmarkScope } from "./types"

export class BookmarkPlugin extends BasePlugin<BasePluginConfig, BookmarkCapability> {
  static readonly id = "bookmark" as const

  constructor(id: string, registry: PluginRegistry) {
    super(id, registry)
  }

  async initialize(_: BasePluginConfig): Promise<void> {}

  // ─────────────────────────────────────────────────────────
  // Capability
  // ─────────────────────────────────────────────────────────

  protected buildCapability(): BookmarkCapability {
    return {
      // Active document operations
      getBookmarks: () => this.getBookmarks(),
      setBookmarks: (bookmarks) => this.setBookmarks(bookmarks),
      addBookmarks: (bookmarks) => this.addBookmarks(bookmarks),

      // Document-scoped operations
      forDocument: (documentId: string) => this.createBookmarkScope(documentId),
    }
  }

  // ─────────────────────────────────────────────────────────
  // Document Scoping
  // ─────────────────────────────────────────────────────────

  private createBookmarkScope(documentId: string): BookmarkScope {
    return {
      getBookmarks: () => this.getBookmarks(documentId),
      setBookmarks: (bookmarks) => this.setBookmarks(bookmarks, documentId),
      addBookmarks: (bookmarks) => this.addBookmarks(bookmarks, documentId),
    }
  }

  // ─────────────────────────────────────────────────────────
  // Core Operations
  // ─────────────────────────────────────────────────────────

  private getBookmarks(
    documentId?: string,
  ): Task<{ bookmarks: PdfBookmarkObject[] }, PdfErrorReason> {
    const id = documentId ?? this.getActiveDocumentId()
    const coreDoc = this.coreState.core.documents[id]

    if (!coreDoc?.document) {
      throw new Error(`Document ${id} not loaded`)
    }

    return this.engine.getBookmarks(coreDoc.document)
  }

  private setBookmarks(
    bookmarks: PdfBookmarkObject[],
    documentId?: string,
  ): Task<boolean, PdfErrorReason> {
    const id = documentId ?? this.getActiveDocumentId()
    const coreDoc = this.coreState.core.documents[id]

    if (!coreDoc?.document) {
      throw new Error(`Document ${id} not loaded`)
    }

    return this.engine.setBookmarks(coreDoc.document, bookmarks)
  }

  private async addBookmarks(
    bookmarks: PdfBookmarkObject[],
    documentId?: string,
  ): Promise<boolean> {
    const id = documentId ?? this.getActiveDocumentId()
    const coreDoc = this.coreState.core.documents[id]

    if (!coreDoc?.document) {
      throw new Error(`Document ${id} not loaded`)
    }

    const existing = await this.engine.getBookmarks(coreDoc.document).toPromise()
    return this.engine
      .setBookmarks(coreDoc.document, [...existing.bookmarks, ...bookmarks])
      .toPromise()
  }
}
