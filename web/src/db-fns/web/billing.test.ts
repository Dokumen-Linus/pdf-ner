import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "@/db/client"
import { users } from "@/db/schemas/web"

import { setAuthenticated } from "../../../tests/bun-test-setup/mocks"

import {
  confirmSetupIntent,
  createSetupIntent,
  detachPaymentMethod,
  getBillingAccount,
  inviteOrganizationUser,
  setDefaultPaymentMethod,
  upgradeIndividualToOrganization,
} from "./billing"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../")

const runTests = process.env.TEST_DB === "true"

async function readRepoFile(path: string) {
  return readFile(resolve(repoRoot, path), "utf8")
}

describe("billing intent status semantics", () => {
  it("keeps billing statuses to stripe_info_missing, active, and past_due", async () => {
    const files = await Promise.all([
      readRepoFile("db/migrations/00008_create_web_organizations.sql"),
      readRepoFile("db/migrations/00010_create_users.sql"),
      readRepoFile("web/src/db/schemas/web/organizations.ts"),
      readRepoFile("web/src/db/schemas/web/users.ts"),
      readRepoFile("web/src/routes/_private.tsx"),
      readRepoFile("web/src/db-fns/web/billing.ts"),
      readRepoFile("web/src/lib/auth.ts"),
    ])
    const billingSource = files.join("\n")

    expect(billingSource).toContain("stripe_info_missing")
    expect(billingSource).not.toContain("payment_required")
    expect(billingSource).not.toMatch(/billing_status[^;\n]*disabled/)
    expect(billingSource).not.toMatch(/billingStatus:\s*"disabled"/)
    expect(billingSource).toContain(
      "CHECK (billing_status IN ('stripe_info_missing', 'active', 'past_due'))",
    )
  })

  it("creates new individual billable accounts with a monthly anchor", async () => {
    const authSource = await readRepoFile("web/src/lib/auth.ts")
    const userSql = await readRepoFile("db/migrations/00010_create_users.sql")

    expect(userSql).toContain("billing_started_at TIMESTAMPTZ DEFAULT NOW()")
    expect(userSql).toContain("next_payment_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 month'")
    expect(authSource).toContain('billingStatus: "stripe_info_missing"')
    expect(authSource).toContain("billingStartedAt: createdAt")
    expect(authSource).toContain("nextPaymentAt: addOneMonth(createdAt)")
  })

  it("gates only missing Stripe setup and keeps past_due accounts usable", async () => {
    const privateRoute = await readRepoFile("web/src/routes/_private.tsx")

    expect(privateRoute).toContain('user.billingStatus !== "stripe_info_missing"')
    expect(privateRoute).toContain('row?.billingStatus !== "stripe_info_missing"')
    expect(privateRoute).not.toContain('billingStatus !== "past_due"')
  })

  it("activates after saving Stripe data without resetting existing billing anchors", async () => {
    const billingSource = await readRepoFile("web/src/db-fns/web/billing.ts")

    expect(billingSource).toContain("stripePaymentMethodId: paymentMethodId")
    expect(billingSource).toContain("billingStartedAt: sql`COALESCE(")
    expect(billingSource).toContain("nextPaymentAt: sql`COALESCE(")
    expect(billingSource).toContain('billingStatus: "active"')
  })

  it("copies billing state on individual-to-organization upgrade and makes the user non-billable", async () => {
    const billingSource = await readRepoFile("web/src/db-fns/web/billing.ts")

    expect(billingSource).toContain("billingStartedAt: user.billingStartedAt")
    expect(billingSource).toContain("nextPaymentAt: user.nextPaymentAt")
    expect(billingSource).toContain("lastPaymentAt: user.lastPaymentAt")
    expect(billingSource).toContain("billingStatus: user.billingStatus")
    expect(billingSource).toContain("stripeCustomerId: user.stripeCustomerId")
    expect(billingSource).toContain("stripePaymentMethodId: user.stripePaymentMethodId")
    expect(billingSource).toContain('role: "admin"')
    expect(billingSource).toContain("billingStartedAt: null")
    expect(billingSource).toContain("nextPaymentAt: null")
    expect(billingSource).toContain('billingStatus: "stripe_info_missing"')
  })
})

describe.if(runTests)("Billing functions", () => {
  const testUserId = crypto.randomUUID()
  const testEmail = `billing-test-${Date.now()}@example.com`

  beforeEach(async () => {
    // Create a test user
    await db.insert(users).values({
      id: testUserId,
      email: testEmail,
      displayName: "Billing Test User",
      role: "individual",
      billingStatus: "stripe_info_missing",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    setAuthenticated({ id: testUserId, email: testEmail })
  })

  afterEach(async () => {
    // Clean up
    await db.delete(users).where(eq(users.id, testUserId))
  })

  it("getBillingAccount returns account info for user without stripe setup", async () => {
    const result = await getBillingAccount()
    expect(result.type).toBe("individual")
    expect(result.stripeCustomerId).toBeNull()
    expect(result.stripePaymentMethodId).toBeNull()
    expect(result.paymentMethods).toEqual([])
  })

  it("createSetupIntent creates a setup intent", async () => {
    const result = await createSetupIntent()
    expect(result.clientSecret).toBeDefined()
    expect(typeof result.clientSecret).toBe("string")
  })

  it("confirmSetupIntent activates billing for individual", async () => {
    const setupIntentId = `seti_${crypto.randomUUID().replace(/-/g, "")}`
    const result = await confirmSetupIntent({ data: { setupIntentId } })
    expect(result.success).toBe(true)

    // Check user was updated
    const [user] = await db.select().from(users).where(eq(users.id, testUserId)).limit(1)
    expect(user.billingStatus).toBe("active")
    expect(user.stripeCustomerId).toBeDefined()
    expect(user.stripePaymentMethodId).toBeDefined()
    expect(user.billingStartedAt).toBeDefined()
    expect(user.nextPaymentAt).toBeDefined()
  })

  it("setDefaultPaymentMethod updates default payment method", async () => {
    // First, confirm setup to have a payment method
    const setupIntentId = `seti_${crypto.randomUUID().replace(/-/g, "")}`
    await confirmSetupIntent({ data: { setupIntentId } })

    const newPaymentMethodId = `pm_${crypto.randomUUID().replace(/-/g, "")}`
    const result = await setDefaultPaymentMethod({ data: { paymentMethodId: newPaymentMethodId } })
    expect(result.success).toBe(true)

    // Check user was updated
    const [user] = await db.select().from(users).where(eq(users.id, testUserId)).limit(1)
    expect(user.stripePaymentMethodId).toBe(newPaymentMethodId)
    expect(user.billingStatus).toBe("active")
  })

  it("detachPaymentMethod removes a payment method", async () => {
    // First, confirm setup
    const setupIntentId = `seti_${crypto.randomUUID().replace(/-/g, "")}`
    await confirmSetupIntent({ data: { setupIntentId } })

    const paymentMethodId = `pm_${crypto.randomUUID().replace(/-/g, "")}`
    const result = await detachPaymentMethod({ data: { paymentMethodId } })
    expect(result.success).toBe(true)
  })

  it("upgradeIndividualToOrganization upgrades user to organization", async () => {
    // First, set up billing
    const setupIntentId = `seti_${crypto.randomUUID().replace(/-/g, "")}`
    await confirmSetupIntent({ data: { setupIntentId } })

    const result = await upgradeIndividualToOrganization()
    expect(result.organizationId).toBeDefined()
    expect(result.teamId).toBeDefined()

    // Check user was updated
    const [user] = await db.select().from(users).where(eq(users.id, testUserId)).limit(1)
    expect(user.role).toBe("admin")
    expect(user.organizationId).toBe(result.organizationId)
    expect(user.stripeCustomerId).toBeNull()
    expect(user.stripePaymentMethodId).toBeNull()
    expect(user.billingStatus).toBe("stripe_info_missing")
  })

  it("inviteOrganizationUser throws for non-admin", async () => {
    // User is individual, not admin
    await expect(
      inviteOrganizationUser({
        data: {
          email: "new@example.com",
          role: "developer",
          teamIds: [crypto.randomUUID()],
        },
      }),
    ).rejects.toThrow("Only organization admins can invite users")
  })
})
