import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { EntityType } from "../entity-type"

// define state initial values and types
const initialState = {
  // name -> EntityType
  byName: {} as Record<string, EntityType>,
}

// define state actions
export type EntityTypeStore = typeof initialState & {
  setByName: (byName: Record<string, EntityType>) => void
  patchEntityType: (name: string, patch: Partial<EntityType>) => void
  // fetchByName: () => Promise<void>
  reset: () => void
}

// create store
const useEntityTypeStore = create<EntityTypeStore>()(
  // persist in local storage on page refresh
  persist(
    (set) => ({
      ...initialState,
      setByName: (byName) => set({ byName }),

      patchEntityType: (name, patch) =>
        set((state) => {
          const entity = state.byName[name]
          if (!entity) return {}
          return {
            byName: {
              ...state.byName,
              [name]: {
                ...entity,
                ...patch,
              },
            },
          }
        }),

      reset: () => set(initialState),
    }),
    { name: "entity-type-store" },
  ),
)
export default useEntityTypeStore
