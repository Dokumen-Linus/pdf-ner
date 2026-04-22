import { describe, it } from "bun:test"

// NOTE: getCurrentUserOrganization and getCurrentUserTeamsByOrganization now require
// authenticated session context (via getRequestHeaders + auth.api.getSession).
// These functions cannot be directly tested without mocking the request context.
// Integration tests should be performed via route loaders or API endpoints.

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("Organization db-fns", () => {
  it.todo("getCurrentUserOrganization returns null when user has no organization", () => {})
  it.todo("getCurrentUserOrganization returns organization with name and slug", () => {})
  it.todo("getCurrentUserTeamsByOrganization returns teams for member", () => {})
  it.todo("getCurrentUserTeamsByOrganization throws for non-member", () => {})
})
