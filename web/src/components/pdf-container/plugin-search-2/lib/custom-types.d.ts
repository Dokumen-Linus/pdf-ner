import { SearchResult } from "@embedpdf/models"

export interface SearchResultState {
  // Current search results from last search operation
  results: SearchResult[]
  // Current active result index (0-based)
  activeResultIndex: number
  // Whether to show all search results or only the active one
  showAllResults: boolean
  // Whether search is currently active
  active: boolean
}
