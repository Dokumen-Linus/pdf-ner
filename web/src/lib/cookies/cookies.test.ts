import { afterEach, describe, expect, it, mock } from "bun:test"

// mock.module is hoisted before imports by Bun.
// In non-Vite environments @tanstack/react-start resolves to start-fn-stubs,
// which returns no-op stubs for createIsomorphicFn/createClientOnlyFn.
// We replace them here so the client branch actually executes.
mock.module("@tanstack/react-start", () => ({
  createIsomorphicFn: () => ({
    server: (_: (...args: unknown[]) => unknown) => ({
      client: (clientFn: (...args: unknown[]) => unknown) =>
        (...args: unknown[]) => clientFn(...args),
    }),
  }),
  createClientOnlyFn: (fn: (...args: unknown[]) => unknown) => fn,
}))

// Server-side cookie functions are never called in the client branch.
mock.module("@tanstack/react-start/server", () => ({
  getCookie: () => undefined,
  setCookie: () => {},
  deleteCookie: () => {},
}))

import Cookies from "js-cookie"
// Import AFTER mocks so the modules pick up the mocked @tanstack/react-start.
const { getCookie, setCookie, setCookies } = await import(".")

afterEach(() => {
  Object.keys(Cookies.get()).forEach((name) => Cookies.remove(name))
})

// ---------------------------------------------------------------------------
// getCookie
// ---------------------------------------------------------------------------

describe("getCookie", () => {
  it("returns the cookie value when it exists", () => {
    Cookies.set("lang", "en")
    expect(getCookie("lang")).toBe("en")
  })

  it("returns undefined when cookie is missing and no default given", () => {
    expect(getCookie("missing")).toBeUndefined()
  })

  it("returns the default value when cookie is missing", () => {
    expect(getCookie("theme", "dark")).toBe("dark")
  })

  it("returns the default value when cookie is empty string", () => {
    // js-cookie stores "" as the literal value; the || fallback treats it as missing
    Cookies.set("flag", "")
    expect(getCookie("flag", "fallback")).toBe("fallback")
  })

  it("returns the cookie value over the default when cookie exists", () => {
    Cookies.set("colorScheme", "light")
    expect(getCookie("colorScheme", "dark")).toBe("light")
  })
})

// ---------------------------------------------------------------------------
// setCookie
// ---------------------------------------------------------------------------

describe("setCookie", () => {
  it("sets a cookie that getCookie can read back", () => {
    setCookie("lang", "fr", 365)
    expect(getCookie("lang")).toBe("fr")
  })

  it("overwrites an existing cookie value", () => {
    setCookie("lang", "en", 365)
    setCookie("lang", "de", 365)
    expect(getCookie("lang")).toBe("de")
  })

  it("deletes the cookie when value is omitted", () => {
    setCookie("lang", "en", 365)
    setCookie("lang")
    expect(getCookie("lang")).toBeUndefined()
  })

  it("deletes the cookie when value is undefined", () => {
    setCookie("lang", "en", 365)
    setCookie("lang", undefined)
    expect(getCookie("lang")).toBeUndefined()
  })

  it("sets a cookie with the default 7-day expiry when expires is omitted", () => {
    setCookie("pref", "compact")
    expect(getCookie("pref")).toBe("compact")
  })
})

// ---------------------------------------------------------------------------
// setCookies
// ---------------------------------------------------------------------------

describe("setCookies", () => {
  it("sets multiple cookies in one call", () => {
    setCookies([
      { name: "tz", value: "Europe/London", expires: 365 },
      { name: "colorScheme", value: "dark", expires: 365 },
    ])
    expect(getCookie("tz")).toBe("Europe/London")
    expect(getCookie("colorScheme")).toBe("dark")
  })

  it("deletes a cookie when value is omitted in the batch", () => {
    setCookie("session", "abc", 1)
    setCookies([{ name: "session" }])
    expect(getCookie("session")).toBeUndefined()
  })

  it("mixes sets and deletes in one call", () => {
    setCookie("old", "value", 7)
    setCookies([
      { name: "old" },
      { name: "new", value: "hello", expires: 30 },
    ])
    expect(getCookie("old")).toBeUndefined()
    expect(getCookie("new")).toBe("hello")
  })
})
