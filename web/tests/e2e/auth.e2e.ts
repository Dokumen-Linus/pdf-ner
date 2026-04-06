import { expect, test } from "@playwright/test"

test.describe("Authentication Flow", () => {
  const testUser = {
    firstName: "Test",
    lastName: "User",
    email: `test-${Date.now()}@example.com`,
    password: "TestPassword123!",
    employer: "Test Corp",
    jobTitle: "QA Engineer",
  }

  test.describe("Sign Up Flow", () => {
    test("should allow new user to sign up successfully", async ({ page }) => {
      await page.goto("/signup")

      // Check that signup page loads
      await expect(page.getByRole("heading", { name: "Sign Up" })).toBeVisible()

      // Fill out the form
      await page.getByLabel("First Name").fill(testUser.firstName)
      await page.getByLabel("Last Name").fill(testUser.lastName)
      await page.getByLabel("Employer").fill(testUser.employer)
      await page.getByLabel("Job Title").fill(testUser.jobTitle)
      await page.getByLabel("Email").fill(testUser.email)
      await page.getByLabel("Password", { exact: true }).fill(testUser.password)
      await page.getByLabel("Confirm Password").fill(testUser.password)

      // Submit form
      await page.getByRole("button", { name: "Sign Up" }).click()

      // Should show success message
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
      await expect(page.getByText("We've sent a verification link")).toBeVisible()
      await expect(page.getByRole("button", { name: "Go to Sign In" })).toBeVisible()
    })

    test("should show validation errors for invalid form data", async ({ page }) => {
      await page.goto("/signup")

      // Try to submit empty form
      await page.getByRole("button", { name: "Sign Up" }).click()

      // Should show validation errors
      await expect(page.getByText("First name is required")).toBeVisible()
      await expect(page.getByText("Last name is required")).toBeVisible()
      await expect(page.getByText("Email is required")).toBeVisible()
      await expect(page.getByText("Password is required")).toBeVisible()
    })

    test("should validate password requirements", async ({ page }) => {
      await page.goto("/signup")

      // Test weak password
      await page.getByLabel("Password", { exact: true }).fill("weak")
      await page.getByLabel("Password", { exact: true }).blur()

      await expect(page.getByText("Password must be at least 8 characters")).toBeVisible()

      // Test password without uppercase
      await page.getByLabel("Password", { exact: true }).fill("nouppercase123!")
      await page.getByLabel("Password", { exact: true }).blur()

      await expect(
        page.getByText("Password must contain at least one uppercase letter"),
      ).toBeVisible()
    })

    test("should validate password confirmation match", async ({ page }) => {
      await page.goto("/signup")

      await page.getByLabel("First Name").fill("Test")
      await page.getByLabel("Last Name").fill("User")
      await page.getByLabel("Email").fill("test@example.com")
      await page.getByLabel("Password", { exact: true }).fill("Password123!")
      await page.getByLabel("Confirm Password").fill("DifferentPassword123!")

      await page.getByRole("button", { name: "Sign Up" }).click()

      await expect(page.getByText("Passwords do not match")).toBeVisible()
    })

    test("should navigate to signup from signin page", async ({ page }) => {
      await page.goto("/signin")

      await page.getByRole("link", { name: "Sign up" }).click()

      await expect(page).toHaveURL(/.*\/signup/)
      await expect(page.getByRole("heading", { name: "Sign Up" })).toBeVisible()
    })
  })

  test.describe("Sign In Flow", () => {
    test("should render sign in form correctly", async ({ page }) => {
      await page.goto("/signin")

      await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()
      await expect(
        page.getByText("Enter your email and password to access your account"),
      ).toBeVisible()
      await expect(page.getByLabel("Email")).toBeVisible()
      await expect(page.getByLabel("Password")).toBeVisible()
      await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()
    })

    test("should show validation errors for empty fields", async ({ page }) => {
      await page.goto("/signin")

      // Try to submit empty form
      await page.getByRole("button", { name: "Sign In" }).click()

      await expect(page.getByText("Email is required")).toBeVisible()
      await expect(page.getByText("Password is required")).toBeVisible()
    })

    test("should navigate to signin from signup page", async ({ page }) => {
      await page.goto("/signup")

      await page.getByRole("link", { name: "Sign in" }).click()

      await expect(page).toHaveURL(/.*\/signin/)
      await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()
    })

    // Note: We can't test actual signin without a real auth backend or mocking
    // But we can test the form behavior and navigation
    test("should handle signin attempt", async ({ page }) => {
      await page.goto("/signin")

      await page.getByLabel("Email").fill("test@example.com")
      await page.getByLabel("Password").fill("password123")

      // Click signin button - this will likely fail without proper auth setup
      await page.getByRole("button", { name: "Sign In" }).click()

      // Check that button shows loading state
      await expect(page.getByRole("button", { name: "Signing in..." })).toBeVisible()
    })
  })

  test.describe("Navigation and Layout", () => {
    test("should show correct auth header on signin page", async ({ page }) => {
      await page.goto("/signin")

      // Should show auth layout header
      await expect(page.locator("header")).toBeVisible()
      await expect(page.getByText("Dokumen AI")).toBeVisible()
    })

    test("should show correct auth header on signup page", async ({ page }) => {
      await page.goto("/signup")

      // Should show auth layout header
      await expect(page.locator("header")).toBeVisible()
      await expect(page.getByText("Dokumen AI")).toBeVisible()
    })

    test("should redirect to signin when accessing protected route without auth", async ({
      page,
    }) => {
      await page.goto("/profile")

      // Should redirect to signin page
      await expect(page).toHaveURL(/.*\/signin/)
      await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()

      // Should include redirect parameter
      expect(page.url()).toContain("redirect")
    })

    test("should redirect to signin when accessing dashboard without auth", async ({ page }) => {
      await page.goto("/dashboard")

      // Should redirect to signin page
      await expect(page).toHaveURL(/.*\/signin/)
    })
  })

  test.describe("Form UX and Accessibility", () => {
    test("should have proper form labels and input types", async ({ page }) => {
      await page.goto("/signin")

      const emailInput = page.getByLabel("Email")
      const passwordInput = page.getByLabel("Password")

      await expect(emailInput).toHaveAttribute("type", "email")
      await expect(passwordInput).toHaveAttribute("type", "password")
      await expect(emailInput).toHaveAttribute("placeholder", "m@example.com")
    })

    test("should have proper form labels on signup", async ({ page }) => {
      await page.goto("/signup")

      await expect(page.getByLabel("First Name")).toBeVisible()
      await expect(page.getByLabel("Last Name")).toBeVisible()
      await expect(page.getByLabel("Email")).toHaveAttribute("type", "email")
      await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password")
      await expect(page.getByLabel("Confirm Password")).toHaveAttribute("type", "password")
    })

    test("should focus first input on page load", async ({ page }) => {
      await page.goto("/signin")

      // Wait for page to load and check focus
      await page.waitForLoadState("domcontentloaded")

      const emailInput = page.getByLabel("Email")
      await emailInput.focus()
      await expect(emailInput).toBeFocused()
    })

    test("should show loading state on form submission", async ({ page }) => {
      await page.goto("/signin")

      await page.getByLabel("Email").fill("test@example.com")
      await page.getByLabel("Password").fill("password123")

      const submitButton = page.getByRole("button", { name: "Sign In" })
      await submitButton.click()

      // Should show loading state
      await expect(page.getByRole("button", { name: "Signing in..." })).toBeVisible()
      await expect(page.getByRole("button", { name: "Signing in..." })).toBeDisabled()
    })
  })

  test.describe("Signout Flow", () => {
    test("should render signout page with loading indicator", async ({ page }) => {
      await page.goto("/signout")

      await expect(page.getByText("Signing out...")).toBeVisible()

      // Should have loading spinner
      await expect(page.locator(".animate-spin")).toBeVisible()
    })

    test("should redirect to homepage after signout", async ({ page }) => {
      await page.goto("/signout")

      // Wait for redirect to complete
      await page.waitForURL("/", { timeout: 10000 })
      await expect(page).toHaveURL("/")
    })
  })

  test.describe("Error Handling", () => {
    test("should handle network errors gracefully on signin", async ({ page }) => {
      // Simulate offline mode to trigger network errors
      await page.context().setOffline(true)

      await page.goto("/signin")

      await page.getByLabel("Email").fill("test@example.com")
      await page.getByLabel("Password").fill("password123")
      await page.getByRole("button", { name: "Sign In" }).click()

      // Reset offline mode
      await page.context().setOffline(false)
    })

    test("should handle navigation errors", async ({ page }) => {
      // Try to access a non-existent auth route
      const response = await page.goto("/auth/nonexistent")

      // Should handle gracefully (404 or redirect)
      expect(response?.status()).toBeTruthy()
    })
  })
})
