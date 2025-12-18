import { useEffect, useState } from "react"
import { useCapability, usePlugin } from "@embedpdf/core/react"
import { SearchPlugin, SearchState } from "../lib"
import { initialState } from "../lib/state"

export const useSearchPlugin = () => usePlugin<SearchPlugin>(SearchPlugin.id)
export const useSearchCapability = () => useCapability<SearchPlugin>(SearchPlugin.id)

export const useSearch = () => {
  const { provides } = useSearchCapability()
  const [searchState, setSearchState] = useState<SearchState>(initialState)

  useEffect(() => {
    return provides?.onStateChange((state) => setSearchState(state))
  }, [provides])

  return {
    state: searchState,
    provides,
  }
}
