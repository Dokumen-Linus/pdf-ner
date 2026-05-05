---
name: dokumen-cookies
description: Isomorphic cookie management for TanStack Start -- getCookie (server/client), setCookie (server/client), setCookies (client-only batch). Import from @/lib/cookies. Built on createIsomorphicFn/createClientOnlyFn from @tanstack/react-start and js-cookie.
---

## Setup

```tsx
import { getCookie, setCookie, setCookies } from "@/lib/cookies"
```

All cookie functions live in `src/lib/cookies/` and are barrel-exported from `src/lib/cookies/index.ts`.

## Core Patterns

### Read a cookie (server or client)

`getCookie` is an isomorphic function built with `createIsomorphicFn()`. On the server it uses `@tanstack/react-start/server`'s `getCookie`. On the client it uses `js-cookie`.

```tsx
import { getCookie } from "@/lib/cookies"

// With default value -- return type is the literal type of defaultValue
const theme = getCookie("colorScheme", "auto")
// theme: "auto" (type: "auto", never undefined)

// With string default -- return type is string
const lang = getCookie("lang", "en")
// lang: string (never undefined)

// Without default -- return type is string | undefined
const token = getCookie("session")
// token: string | undefined
```

Three overloads:
- `getCookie(name, defaultValue: T)` returns `T` (literal string type preserved)
- `getCookie(name, defaultValue: string)` returns `string`
- `getCookie(name)` returns `string | undefined`

### Set or delete a cookie (server or client)

`setCookie` is isomorphic. Pass expiration as number of days.

```tsx
import { setCookie } from "@/lib/cookies"

// Set with custom expiration (days)
setCookie("lang", "en", 365)

// Set with default expiration (7 days)
setCookie("theme", "dark")

// Delete a cookie -- omit the value parameter
setCookie("session")
```

When `value` is omitted or `undefined`, the cookie is deleted (server: `deleteCookie`, client: `Cookies.remove`).

### Batch set cookies on the client

`setCookies` is a client-only function built with `createClientOnlyFn()`. Use inside `useEffect` or client event handlers only.

```tsx
import { setCookies } from "@/lib/cookies"

setCookies([
  { name: "tz", value: Intl.DateTimeFormat().resolvedOptions().timeZone, expires: 365 },
  { name: "colorScheme", value: "dark", expires: 365 },
])
```

The `Cookie` interface:
```ts
interface Cookie {
  name: string
  value?: string   // omit to delete
  expires?: number // days, defaults to 7
}
```

## Common Mistakes

### CRITICAL: Call setCookies on the server side

Wrong:
```tsx
// In a createServerFn or server middleware
import { setCookies } from "@/lib/cookies"

setCookies([{ name: "lang", value: "en" }])
```

Correct:
```tsx
// On server: use setCookie (singular, isomorphic)
import { setCookie } from "@/lib/cookies"

setCookie("lang", "en", 365)
```

`setCookies` is built with `createClientOnlyFn()` and throws on the server. Use the singular `setCookie` for server-side cookie writes.

Source: web/src/lib/cookie/setCookies.ts

### HIGH: Pass expires as Date instead of number

Wrong:
```tsx
import { setCookie } from "@/lib/cookies"

setCookie("token", "abc", new Date("2026-12-31"))
```

Correct:
```tsx
import { setCookie } from "@/lib/cookies"

setCookie("token", "abc", 365)
```

The `expires` parameter is a number of days. Internally `setCookie` creates the `Date` by adding that many days to `new Date()`.

Source: web/src/lib/cookie/setCookie.ts

### HIGH: Assume getCookie always returns string

Wrong:
```tsx
import { getCookie } from "@/lib/cookies"

const token = getCookie("session")
fetch("/api", { headers: { Authorization: token } }) // TypeError: token may be undefined
```

Correct:
```tsx
import { getCookie } from "@/lib/cookies"

const token = getCookie("session")
if (token) fetch("/api", { headers: { Authorization: token } })

// Or provide a default
const safeToken = getCookie("session", "")
```

Without a `defaultValue`, `getCookie` returns `string | undefined`.

Source: web/src/lib/cookie/getCookie.ts

### MEDIUM: Empty string value triggers deletion

Wrong:
```tsx
import { setCookie } from "@/lib/cookies"

setCookie("flag", "") // Actually deletes the cookie!
```

Correct:
```tsx
import { setCookie } from "@/lib/cookies"

setCookie("flag", "none") // sentinel value for blank state
setCookie("flag")         // intentional delete
```

The implementation uses `if (value)` to decide between set and delete. An empty string is falsy and triggers deletion.

Source: web/src/lib/cookies/setCookie.ts

### MEDIUM: Default expiration is 7 days, not a session cookie

Wrong:
```tsx
import { setCookie } from "@/lib/cookies"

setCookie("preference", "compact") // Expecting session cookie -- actually expires in 7 days
```

Correct:
```tsx
import { setCookie } from "@/lib/cookies"

setCookie("preference", "compact", 365)
```

When `expires` is omitted it defaults to 7 days. There is no way to create a session-only (no-expiry) cookie through this API.

Source: web/src/lib/cookies/setCookie.ts

## Why use this instead of @tanstack/react-start/server directly

TanStack Start's `getCookie`/`setCookie`/`deleteCookie` from `@tanstack/react-start/server` only work inside a server function or middleware context — calling them outside throws. On the client they don't exist at all. Without this wrapper every cookie access requires an environment split:

```tsx
// Without the wrapper — split required everywhere
if (import.meta.env.SSR) {
  const { getCookie } = await import("@tanstack/react-start/server")
  value = getCookie("theme")
} else {
  value = document.cookie // or js-cookie manually
}
```

This wrapper eliminates the split. A single call works in `beforeLoad`, server functions, middleware, and client components without branching.

| Problem with raw API | What the wrapper provides |
|---|---|
| Server and client APIs are different imports | Single `@/lib/cookies` import works everywhere |
| Server takes a `Date`, js-cookie takes an options object | `setCookie("key", "val", 365)` — days, consistent |
| Deleting requires `deleteCookie` on server, `Cookies.remove()` on client | `setCookie("key")` — omit value to delete, both environments |
| No batch primitive | `setCookies([...])` for initialising multiple preferences at once |
| Default expiry differs by platform | Explicit 7-day default, consistent |
| Empty-string-as-delete is a footgun | Deliberate behaviour, documented above |

Common high-value uses in this app where reading server-side eliminates flash or round-trips:
- **Theme** — read in `beforeLoad` so SSR renders the correct colour scheme
- **Locale** — correct i18n on first render before JS hydrates
- **Last visited project** — redirect after login without a query param
- **PDF viewer preferences** — zoom level, layout mode, persisted across sessions

## Testing

`createIsomorphicFn` from `@tanstack/react-start` resolves to a no-op stub outside the Vite build pipeline. Tests must mock the module before importing cookie functions:

```ts
import { mock } from "bun:test"

mock.module("@tanstack/react-start", () => ({
  createIsomorphicFn: () => ({
    server: (_: (...args: unknown[]) => unknown) => ({
      client: (clientFn: (...args: unknown[]) => unknown) =>
        (...args: unknown[]) => clientFn(...args),
    }),
  }),
  createClientOnlyFn: (fn: (...args: unknown[]) => unknown) => fn,
}))

mock.module("@tanstack/react-start/server", () => ({
  getCookie: () => undefined,
  setCookie: () => {},
  deleteCookie: () => {},
}))

// Import AFTER mocks
const { getCookie, setCookie, setCookies } = await import("@/lib/cookies")
```

See `web/src/lib/cookies/cookies.test.ts` for the full test suite (13 tests).

Source: web/src/lib/cookie/setCookie.ts
