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
}
