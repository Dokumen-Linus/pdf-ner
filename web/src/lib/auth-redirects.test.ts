import { describe, expect, it } from "bun:test"
import {
  DEFAULT_POST_VERIFICATION_REDIRECT,
  getPostVerificationRedirect,
} from "./auth-redirects"

describe("getPostVerificationRedirect", () => {
  it("falls back to the default app destination when no redirect is provided", () => {
    expect(getPostVerificationRedirect()).toBe(DEFAULT_POST_VERIFICATION_REDIRECT)
    expect(getPostVerificationRedirect("")).toBe(DEFAULT_POST_VERIFICATION_REDIRECT)
    expect(getPostVerificationRedirect("   ")).toBe(DEFAULT_POST_VERIFICATION_REDIRECT)
  })

  it("preserves an explicit redirect for post-verification sign-in", () => {
    expect(getPostVerificationRedirect("/projects/project-123")).toBe("/projects/project-123")
  })
})
