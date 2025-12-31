import { MatchFlag, SearchResult } from "@embedpdf/models"

// ***PLUGIN STATE***
export interface SearchState {
  flags: MatchFlag[]
  // Current search results from last search operation
  results: SearchResult[]
  // Total number of search results
  total: number
  // Current active result index (0-based)
  activeResultIndex: number
  // Whether to show all search results or only the active one
  showAllResults: boolean
  // Current search query
  query: string
  // Whether a search operation is in progress
  loading: boolean
  // Whether search is currently active
  active: boolean
}

// ***INITIAL STATE***
export const initialState: SearchState = {
  flags: [],
  results: [],
  total: 0,
  activeResultIndex: -1,
  showAllResults: true,
  query: "",
  loading: false,
  active: false,
}
