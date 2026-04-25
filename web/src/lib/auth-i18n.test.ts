import { readFileSync } from "node:fs"

import { describe, expect, it } from "bun:test"

import {
  betterAuthApiErrorTranslations,
  betterAuthApiMessageTranslations,
  betterAuthRedirectErrorTranslations,
  detectAuthLocaleFromHeaders,
  getLocalizedAuthApiMessage,
  getLocalizedAuthRedirectError,
  normalizeAuthLocale,
} from "./auth-i18n"

function readFixture(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8")
}

function collectObjectKeys(source: string) {
  return Array.from(source.matchAll(/([A-Z0-9_]+):\s*"[^"]+"/g), (match) => match[1]!)
}

const betterAuthApiCodes = new Set([
  ...collectObjectKeys(readFixture("../../node_modules/@better-auth/core/src/error/codes.ts")),
  ...collectObjectKeys(
    readFixture("../../node_modules/better-auth/dist/plugins/organization/error-codes.mjs"),
  ),
  ...collectObjectKeys(
    readFixture("../../node_modules/better-auth/dist/plugins/haveibeenpwned/index.mjs"),
  ),
  "ORGANIZATION_DELETION_DISABLED",
])

const betterAuthRedirectCodes = new Set([
  "access_denied",
  "account_already_linked_to_different_user",
  "account_not_linked",
  "banned",
  "client_disabled",
  "consent_required",
  "email_doesn't_match",
  "email_not_found",
  "internal_server_error",
  "invalid_callback_request",
  "invalid_client",
  "invalid_code",
  "invalid_payload",
  "invalid_profile",
  "invalid_request",
  "invalid_scope",
  "login_required",
  "missing_profile",
  "no_callback_url",
  "no_code",
  "oauth_provider_not_found",
  "payload_expired",
  "please_restart_the_process",
  "server_error",
  "signup_disabled",
  "state_mismatch",
  "state_not_found",
  "unable_to_create_session",
  "unable_to_create_user",
  "unable_to_get_user_info",
  "unable_to_link_account",
  "unsupported_response_type",
  "user_creation_failed",
])

const betterAuthFixedEnglishMessages = new Set([
  "Change email is disabled",
  "Email is the same",
  "Invitation not found!",
  "Missing session headers, or email query parameter.",
  "No fields to update",
  "Not a member of this organization",
  "Not authenticated",
  "Organization ID is required",
  "Organization plugin is required for org role authorization",
  "Teams are not enabled",
  "User email cannot be passed for client side API calls.",
  "User not found",
  "Verification email isn't enabled",
])

describe("auth i18n catalog", () => {
  it("covers every Better Auth API error code used by this repo", () => {
    const missing = [...betterAuthApiCodes].filter((code) => !betterAuthApiErrorTranslations.fr[code])
    expect(missing).toEqual([])
  })

  it("covers every Better Auth redirect error code surfaced by auth flows", () => {
    const missing = [...betterAuthRedirectCodes].filter(
      (code) => !betterAuthRedirectErrorTranslations.fr[code],
    )
    expect(missing).toEqual([])
  })

  it("normalizes the Paraglide locale for auth lookups", () => {
    expect(normalizeAuthLocale("fr-CA")).toBe("fr")
    expect(normalizeAuthLocale("en-US")).toBe("en")
    expect(normalizeAuthLocale(undefined)).toBe("en")
  })

  it("prefers the Paraglide locale cookie over Accept-Language for auth flows", () => {
    const headers = new Headers({
      Cookie: "PARAGLIDE_LOCALE=fr; another_cookie=value",
      "Accept-Language": "en-US,en;q=0.9",
    })

    expect(detectAuthLocaleFromHeaders(headers)).toBe("fr")
  })

  it("covers the fixed-string Better Auth messages the stock i18n plugin cannot translate", () => {
    const missing = [...betterAuthFixedEnglishMessages].filter(
      (message) => !betterAuthApiMessageTranslations.fr[message],
    )

    expect(missing).toEqual([])
  })

  it("returns a localized API message when Better Auth responds without an error code", () => {
    expect(getLocalizedAuthApiMessage("Not authenticated", "fr")).toBe("Non authentifie")
    expect(getLocalizedAuthApiMessage("Not authenticated", "en")).toBe("Not authenticated")
    expect(getLocalizedAuthApiMessage("Unknown message", "fr")).toBeNull()
  })

  it("returns a localized redirect error when one exists", () => {
    expect(getLocalizedAuthRedirectError("state_mismatch", "fr")).toBe(
      "L'etat ne correspond pas",
    )
    expect(getLocalizedAuthRedirectError("state_mismatch", "en")).toBe("State mismatch")
    expect(getLocalizedAuthRedirectError("unknown_code", "fr")).toBeNull()
  })
})
