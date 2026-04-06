---
name: zustand
description: Zustand state management for React. Covers store creation, selectors, TypeScript patterns, middleware (persist/devtools/immer), slices, advanced patterns (optimistic updates, undo/redo, context integration, subscriptions), and anti-patterns.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Zustand

Small, fast, scalable state management for React using simplified flux with a hooks-based API.

## Store Creation

```typescript
import { create } from 'zustand'

// Always define explicit interfaces — separate state from actions
interface CounterState {
  count: number
}

interface CounterActions {
  increment: () => void
  decrement: () => void
  reset: () => void
}

type CounterStore = CounterState & CounterActions

const useCounterStore = create<CounterStore>()((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
}))
```

### State Updates

```typescript
set({ count: 5 })                                    // replace (shallow merge)
set((state) => ({ count: state.count + 1 }))          // updater function
```

### Using in Components

```typescript
// ✅ Select only what you need — prevents unnecessary re-renders
const count = useCounterStore((state) => state.count)
const increment = useCounterStore((state) => state.increment)

// ❌ Never select the entire store
const store = useCounterStore()  // re-renders on ANY change
```

### Multiple Selectors with Shallow

```typescript
import { shallow } from 'zustand/shallow'

const { nuts, honey } = useStore(
  (state) => ({ nuts: state.nuts, honey: state.honey }),
  shallow
)
```

### Typed Selector Functions

Reusable, testable selectors:

```typescript
const selectFilteredTodos = (state: TodoStore) => {
  if (state.filter === 'all') return state.todos
  if (state.filter === 'active') return state.todos.filter((t) => !t.completed)
  return state.todos.filter((t) => t.completed)
}

const selectActiveCount = (state: TodoStore) =>
  state.todos.filter((t) => !t.completed).length

// Usage
const todos = useTodoStore(selectFilteredTodos)
const activeCount = useTodoStore(selectActiveCount)
```

### Computed Values with Getters

```typescript
const useStore = create<Store>()((set, get) => ({
  items: [],
  get itemCount() { return get().items.length },
  get hasItems() { return get().items.length > 0 },
}))
```

### Access Outside Components

```typescript
const state = useBearStore.getState()
useBearStore.setState({ bears: 10 })
```

### Reset Pattern

```typescript
const initialState = { count: 0, name: '' }

const useStore = create<Store>()((set) => ({
  ...initialState,
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set(initialState),
}))
```

---

## Middleware

Apply from inside out: `create(devtools(persist(immer(...))))`.

### Persist

```typescript
import { persist, createJSONStorage } from 'zustand/middleware'

const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
    }),
    {
      name: 'shopping-cart',                             // storage key
      storage: createJSONStorage(() => localStorage),    // or sessionStorage
      partialize: (state) => ({ items: state.items }),   // persist only some fields
      version: 1,
      migrate: (persisted: any, version: number) => {    // handle breaking changes
        if (version === 0) { persisted.newField = 'default' }
        return persisted
      },
    }
  )
)
```

#### Hydration Detection

```typescript
function App() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    useStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])

  if (!hydrated) return <div>Loading...</div>
  return <div>App content</div>
}
```

#### Custom Storage (IndexedDB)

```typescript
import { StateStorage } from 'zustand/middleware'
import { get, set, del } from 'idb-keyval'

const indexedDBStorage: StateStorage = {
  getItem: async (name) => (await get(name)) || null,
  setItem: async (name, value) => { await set(name, value) },
  removeItem: async (name) => { await del(name) },
}

// Use: storage: createJSONStorage(() => indexedDBStorage)
```

### DevTools

```typescript
import { devtools } from 'zustand/middleware'

const useStore = create<Store>()(
  devtools(
    (set) => ({
      count: 0,
      increment: () =>
        set((state) => ({ count: state.count + 1 }), false, 'increment'),
    }),
    {
      name: 'CounterStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
)
```

### Immer

Write mutable syntax, get immutable updates:

```typescript
import { immer } from 'zustand/middleware/immer'

const useTodoStore = create<TodoStore>()(
  immer((set) => ({
    todos: [],
    addTodo: (text) =>
      set((state) => {
        state.todos.push({ id: Date.now().toString(), text, completed: false })
      }),
    toggleTodo: (id) =>
      set((state) => {
        const todo = state.todos.find((t) => t.id === id)
        if (todo) todo.completed = !todo.completed
      }),
  }))
)
```

### Combining Middleware

```typescript
const useStore = create<Store>()(
  devtools(
    persist(
      immer((set) => ({
        count: 0,
        todos: [],
        increment: () => set((state) => { state.count++ }),
        addTodo: (text) => set((state) => {
          state.todos.push({ id: Date.now().toString(), text, completed: false })
        }),
      })),
      { name: 'app-storage', partialize: (state) => ({ count: state.count, todos: state.todos }) }
    ),
    { name: 'AppStore' }
  )
)
```

### Custom Middleware

```typescript
import { StateCreator, StoreMutatorIdentifier } from 'zustand'

type Logger = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(f: StateCreator<T, Mps, Mcs>, name?: string) => StateCreator<T, Mps, Mcs>

type LoggerImpl = <T>(f: StateCreator<T, [], []>, name?: string) => StateCreator<T, [], []>

const loggerImpl: LoggerImpl = (f, name) => (set, get, store) => {
  const loggedSet: typeof set = (...a) => {
    set(...a)
    console.log(...(name ? [`${name}:`] : []), get())
  }
  store.setState = loggedSet
  return f(loggedSet, get, store)
}

export const logger = loggerImpl as unknown as Logger
```

---

## Slices (Large Stores)

Type-safe store composition with `StateCreator`:

```typescript
import { create, StateCreator } from 'zustand'

interface BearSlice {
  bears: number
  addBear: () => void
}

interface FishSlice {
  fishes: number
  addFish: () => void
}

const createBearSlice: StateCreator<BearSlice & FishSlice, [], [], BearSlice> = (set) => ({
  bears: 0,
  addBear: () => set((state) => ({ bears: state.bears + 1 })),
})

const createFishSlice: StateCreator<BearSlice & FishSlice, [], [], FishSlice> = (set) => ({
  fishes: 0,
  addFish: () => set((state) => ({ fishes: state.fishes + 1 })),
})

const useBoundStore = create<BearSlice & FishSlice>()((...a) => ({
  ...createBearSlice(...a),
  ...createFishSlice(...a),
}))
```

---

## Advanced Patterns

### Subscriptions

```typescript
// Subscribe to all changes
const unsubscribe = useStore.subscribe((state, prevState) => {
  console.log('State changed:', state)
})

// Subscribe to specific slice
const unsubscribe = useStore.subscribe(
  (state) => state.count,
  (count, prevCount) => {
    console.log(`Count: ${prevCount} → ${count}`)
  },
  { equalityFn: (a, b) => a === b, fireImmediately: false }
)

// Always clean up in useEffect
useEffect(() => {
  const unsub = useStore.subscribe(/* ... */)
  return unsub
}, [])
```

### Optimistic Updates

```typescript
const useTodoStore = create<TodoStore>()((set, get) => ({
  todos: [],

  addTodo: async (text) => {
    const optimistic = { id: `temp-${Date.now()}`, text, completed: false }
    set((state) => ({ todos: [...state.todos, optimistic] }))

    try {
      const saved = await api.createTodo({ text })
      set((state) => ({
        todos: state.todos.map((t) => (t.id === optimistic.id ? saved : t)),
      }))
    } catch {
      set((state) => ({
        todos: state.todos.filter((t) => t.id !== optimistic.id),
      }))
    }
  },

  deleteTodo: async (id) => {
    const prev = get().todos
    set((state) => ({ todos: state.todos.filter((t) => t.id !== id) }))

    try {
      await api.deleteTodo(id)
    } catch {
      set({ todos: prev })  // rollback
    }
  },
}))
```

### Undo/Redo

```typescript
interface HistoryState<T> { past: T[]; present: T; future: T[] }

function createHistoryStore<T>(initial: T) {
  return create<{
    history: HistoryState<T>
    canUndo: boolean
    canRedo: boolean
    set: (val: T) => void
    undo: () => void
    redo: () => void
  }>()((set, get) => ({
    history: { past: [], present: initial, future: [] },
    get canUndo() { return get().history.past.length > 0 },
    get canRedo() { return get().history.future.length > 0 },

    set: (newPresent) =>
      set((s) => ({
        history: {
          past: [...s.history.past, s.history.present],
          present: newPresent,
          future: [],
        },
      })),

    undo: () =>
      set((s) => {
        if (!s.history.past.length) return s
        const prev = s.history.past[s.history.past.length - 1]
        return {
          history: {
            past: s.history.past.slice(0, -1),
            present: prev,
            future: [s.history.present, ...s.history.future],
          },
        }
      }),

    redo: () =>
      set((s) => {
        if (!s.history.future.length) return s
        const next = s.history.future[0]
        return {
          history: {
            past: [...s.history.past, s.history.present],
            present: next,
            future: s.history.future.slice(1),
          },
        }
      }),
  }))
}
```

### React Context Integration (Scoped Stores)

```typescript
import { createContext, useContext, useRef } from 'react'
import { createStore, useStore } from 'zustand'

type TodoStoreApi = ReturnType<typeof createTodoStore>

const createTodoStore = (initialTodos: Todo[] = []) =>
  createStore<TodoStore>()((set) => ({
    todos: initialTodos,
    addTodo: (text) =>
      set((state) => ({
        todos: [...state.todos, { id: Date.now().toString(), text, completed: false }],
      })),
  }))

const TodoCtx = createContext<TodoStoreApi | null>(null)

export function TodoProvider({ children, initialTodos }: { children: React.ReactNode; initialTodos?: Todo[] }) {
  const storeRef = useRef<TodoStoreApi>()
  if (!storeRef.current) storeRef.current = createTodoStore(initialTodos)
  return <TodoCtx.Provider value={storeRef.current}>{children}</TodoCtx.Provider>
}

export function useTodoStore<T>(selector: (state: TodoStore) => T): T {
  const store = useContext(TodoCtx)
  if (!store) throw new Error('useTodoStore must be used within TodoProvider')
  return useStore(store, selector)
}
```

### Store Composition (Cross-Store Access)

```typescript
function createBoundStores() {
  const useAuthStore = create<AuthStore>()((set) => ({
    user: null,
    login: async (creds) => {
      const user = await api.login(creds)
      set({ user })
      await stores.cart.getState().syncCart()
    },
    logout: () => {
      set({ user: null })
      stores.cart.getState().clearCart()
    },
  }))

  const useCartStore = create<CartStore>()((set) => ({
    items: [],
    addItem: (item) => set((s) => ({ items: [...s.items, item] })),
    clearCart: () => set({ items: [] }),
    syncCart: async () => {
      const user = stores.auth.getState().user
      if (!user) return
      set({ items: await api.fetchCart(user.id) })
    },
  }))

  return { auth: useAuthStore, cart: useCartStore }
}

const stores = createBoundStores()
export const useAuthStore = stores.auth
export const useCartStore = stores.cart
```

### Generic Store Factory

```typescript
type AsyncStore<T> = {
  data: T | null; isLoading: boolean; error: string | null
  fetch: () => Promise<void>; reset: () => void
}

function createAsyncStore<T>(fetcher: () => Promise<T>) {
  return create<AsyncStore<T>>()((set) => ({
    data: null, isLoading: false, error: null,
    fetch: async () => {
      set({ isLoading: true, error: null })
      try { set({ data: await fetcher(), isLoading: false }) }
      catch (e) { set({ error: e instanceof Error ? e.message : 'Unknown error', isLoading: false }) }
    },
    reset: () => set({ data: null, isLoading: false, error: null }),
  }))
}

const useUsersStore = createAsyncStore<User[]>(() => fetch('/api/users').then((r) => r.json()))
```

---

## Anti-Patterns

```typescript
// ❌ Mutating state without immer
set((state) => { state.items.push(item); return state })
// ✅ Spread
set((state) => ({ items: [...state.items, item] }))

// ❌ Storing derived state
{ items: [], itemCount: 0, addItem: (i) => set(s => ({ items: [...s.items, i], itemCount: s.items.length + 1 })) }
// ✅ Use a getter
{ items: [], get itemCount() { return get().items.length }, addItem: (i) => set(s => ({ items: [...s.items, i] })) }

// ❌ Splitting related state across multiple stores
const useUserStore = create(...)
const useUserSettingsStore = create(...)
// ✅ Keep related state together or use slices

// ❌ Persisting sensitive data (tokens) to localStorage
// ✅ Use partialize to exclude secrets, store tokens in secure storage

// ❌ Wrong middleware order: persist(devtools(...))
// ✅ devtools(persist(...)) — devtools sees full lifecycle

// ❌ Leaking subscriptions
useEffect(() => { useStore.subscribe(cb) }, [])
// ✅ Return cleanup
useEffect(() => { const unsub = useStore.subscribe(cb); return unsub }, [])

// ❌ Using `any` types
// ✅ Always define explicit store interfaces

// ❌ Circular cross-store dependencies
// ✅ One-way access via getState(), or merge into one store
```
