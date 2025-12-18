import { useCapability, usePlugin } from '@embedpdf/core/@framework';
import { initialState, SearchPlugin, SearchState } from '@embedpdf/plugin-search';
import { useEffect, useState } from '@framework';

export const useSearchPlugin = () => usePlugin<SearchPlugin>(SearchPlugin.id);
export const useSearchCapability = () => useCapability<SearchPlugin>(SearchPlugin.id);

export const useSearch = () => {
  const { provides } = useSearchCapability();
  const [searchState, setSearchState] = useState<SearchState>(initialState);

  useEffect(() => {
    return provides?.onStateChange((state) => setSearchState(state));
  }, [provides]);

  return {
    state: searchState,
    provides,
  };
};
