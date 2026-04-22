import { useCapability } from "@embedpdf/core/react"

import { BookmarkPlugin } from "../lib"

export const useBookmarkCapability = () => useCapability<BookmarkPlugin>(BookmarkPlugin.id)
