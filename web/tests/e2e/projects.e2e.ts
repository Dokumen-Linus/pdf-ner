import { expect, test } from "@playwright/test"

// Override baseURL to use localhost (server binds to IPv6 ::1, not IPv4 127.0.0.1)
test.use({ baseURL: "http://localhost:3000" })

test.describe("Projects Pages", () => {
  test.describe("Unauthenticated Access", () => {
    test("should redirect to signin when accessing projects list without auth", async ({
      page,
    }) => {
      await page.goto("/projects")

      await expect(page).toHaveURL(/.*\/signin/)
      expect(page.url()).toContain("redirect")
    })

    test("should redirect to signin when accessing project details without auth", async ({
      page,
    }) => {
      await page.goto("/projects/00000000-0000-0000-0000-000000000001")

      await expect(page).toHaveURL(/.*\/signin/)
      expect(page.url()).toContain("redirect")
    })

    test("should redirect to signin when accessing project dashboard without auth", async ({
      page,
    }) => {
      await page.goto("/projects/00000000-0000-0000-0000-000000000001/dashboard")

      await expect(page).toHaveURL(/.*\/signin/)
      expect(page.url()).toContain("redirect")
    })

    test("should redirect to signin when accessing project documents without auth", async ({
      page,
    }) => {
      await page.goto("/projects/00000000-0000-0000-0000-000000000001/documents")

      await expect(page).toHaveURL(/.*\/signin/)
      expect(page.url()).toContain("redirect")
    })
  })
})
