---
name: cookies
description: Isomorphic cookie management -- getCookie (server/client), setCookie (server/client), setCookies (client-only batch)
type: foundation
library: "@rolder-kit/tanstack"
library_version: "0.1.0-beta.1"
sources:
  - stable/tanstack/src/cookie/getCookie.ts
  - stable/tanstack/src/cookie/setCookie.ts
  - stable/tanstack/src/cookie/setCookies.ts
---

## Setup

```tsx
import { getCookie, setCookie, setCookies } from "@rolder-kit/tanstack/cookie";
```

All cookie functions are exported from the `"./cookie"` sub-path. There is no root `"."` export in `@rolder-kit/tanstack`.

Peer dependencies: `@tanstack/react-start`, `js-cookie`.

## Core Patterns

### Read a cookie (server or client)

`getCookie` is an isomorphic function built with `createIsomorphicFn()`. On the server it uses `@tanstack/react-start/server`'s `getCookie`. On the client it uses `js-cookie`.

```tsx
import { getCookie } from "@rolder-kit/tanstack/cookie";

// With default value -- return type is the literal type of defaultValue
const theme = getCookie("colorScheme", "auto");
// theme: "auto" (type: "auto", never undefined)

// With string default -- return type is string
const lang = getCookie("lang", "ru");
// lang: string (never undefined)

// Without default -- return type is string | undefined
const token = getCookie("session");
// token: string | undefined
```

The function has three overloads:
- `getCookie(name, defaultValue: T)` returns `T` (literal string type preserved)
- `getCookie(name, defaultValue: string)` returns `string`
- `getCookie(name)` returns `string | undefined`

### Set or delete a cookie (server or client)

`setCookie` is isomorphic. It converts the `expires` number to a `Date` internally.

```tsx
import { setCookie } from "@rolder-kit/tanstack/cookie";

// Set with custom expiration (days)
setCookie("lang", "ru", 365);

// Set with default expiration (7 days)
setCookie("theme", "dark");

// Delete a cookie -- omit the value parameter
setCookie("session");
```

When `value` is omitted or `undefined`, the cookie is deleted (server: `deleteCookie`, client: `Cookies.remove`).

### Batch set cookies on the client

`setCookies` is a client-only function built with `createClientOnlyFn()`. It sets multiple cookies in one call.

```tsx
import { setCookies } from "@rolder-kit/tanstack/cookie";

// Inside a useEffect or client event handler
setCookies([
  { name: "tz", value: Intl.DateTimeFormat().resolvedOptions().timeZone, expires: 365 },
  { name: "colorScheme", value: "dark", expires: 365 },
]);
```

Each entry in the array follows the `Cookie` interface:
```ts
interface Cookie {
  name: string;
  value?: string;   // omit to delete
  expires?: number; // days, defaults to 7
}
```

### Delete a cookie via setCookies

```tsx
import { setCookies } from "@rolder-kit/tanstack/cookie";

// Omit value to delete
setCookies([
  { name: "session" },
  { name: "tempFlag" },
]);
```

## Common Mistakes

### CRITICAL: Import from package root instead of /cookie

Wrong:
```tsx
import { getCookie } from "@rolder-kit/tanstack";
```

Correct:
```tsx
import { getCookie } from "@rolder-kit/tanstack/cookie";
```

`@rolder-kit/tanstack` has no `"."` export -- only `"./cookie"` and `"./middlewares"` exist in the exports map.

Source: stable/tanstack/package.json

### CRITICAL: Call setCookies on the server side

Wrong:
```tsx
// In a createServerFn or server middleware
import { setCookies } from "@rolder-kit/tanstack/cookie";

setCookies([{ name: "lang", value: "ru" }]);
```

Correct:
```tsx
// On server: use setCookie (singular, isomorphic)
import { setCookie } from "@rolder-kit/tanstack/cookie";

setCookie("lang", "ru", 365);
```

`setCookies` is built with `createClientOnlyFn()` and throws on the server. Use the singular `setCookie` (isomorphic) for server-side cookie writes, or move `setCookies` into a `useEffect` or client event handler.

Source: stable/tanstack/src/cookie/setCookies.ts (line 17)

### HIGH: Pass expires as Date instead of number

Wrong:
```tsx
import { setCookie } from "@rolder-kit/tanstack/cookie";

setCookie("token", "abc", new Date("2026-12-31"));
```

Correct:
```tsx
import { setCookie } from "@rolder-kit/tanstack/cookie";

setCookie("token", "abc", 365);
```

The `expires` parameter is a number of days, not a `Date` object. Internally, `setCookie` creates a `Date` by adding `expires` days to the current date.

Source: stable/tanstack/src/cookie/setCookie.ts (lines 18-20)

### HIGH: Assume getCookie always returns string

Wrong:
```tsx
import { getCookie } from "@rolder-kit/tanstack/cookie";

const token = getCookie("session");
fetch("/api", { headers: { Authorization: token } });
// TypeError: token may be undefined
```

Correct:
```tsx
import { getCookie } from "@rolder-kit/tanstack/cookie";

const token = getCookie("session");
if (token) {
  fetch("/api", { headers: { Authorization: token } });
}

// Or provide a default
const safeToken = getCookie("session", "");
```

Without a `defaultValue`, `getCookie` returns `string | undefined`. The function returns the default when the cookie does not exist or is empty.

Source: stable/tanstack/src/cookie/getCookie.ts (lines 15-18)

### MEDIUM: Empty string value triggers deletion

Wrong:
```tsx
import { setCookie } from "@rolder-kit/tanstack/cookie";

// Intending to set an empty value
setCookie("flag", "");
// Actually deletes the cookie!
```

Correct:
```tsx
import { setCookie } from "@rolder-kit/tanstack/cookie";

// Use a sentinel value if you need a "blank" state
setCookie("flag", "none");

// To intentionally delete, omit the value
setCookie("flag");
```

The implementation uses `if (value)` to decide between set and delete. An empty string is falsy, so it triggers `deleteCookie` / `Cookies.remove` instead of setting the cookie.

Source: stable/tanstack/src/cookie/setCookie.ts (lines 21-22)

### MEDIUM: Forget default expiration is 7 days

Wrong:
```tsx
import { setCookie } from "@rolder-kit/tanstack/cookie";

// Expecting a session cookie (no expiry)
setCookie("preference", "compact");
// Actually expires in 7 days
```

Correct:
```tsx
import { setCookie } from "@rolder-kit/tanstack/cookie";

// Explicitly set long-lived expiration
setCookie("preference", "compact", 365);
```

When `expires` is omitted, it defaults to 7 days (`expires || 7`). There is no way to create a session-only cookie through this API.

Source: stable/tanstack/src/cookie/setCookie.ts (line 19)
