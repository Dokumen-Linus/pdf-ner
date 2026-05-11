import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "@/db/client"
import { users } from "@/db/schemas/web"

import { mockStripeForceSetupIntentStatus } from "../../../tests/bun-test-setup/main"
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

describe("billing status enum invariant", () => {
  it("allows only stripe_info_missing, active, and past_due in SQL", async () => {
    const orgSql = await readRepoFile("db/migrations/00008_create_orgs.sql")
    const userSql = await readRepoFile("db/migrations/00010_create_users.sql")

    expect(orgSql).toContain(
      "CHECK (billing_status IN ('stripe_info_missing', 'active', 'past_due'))",
    )
    expect(userSql).toContain(
      "CHECK (billing_status IN ('stripe_info_missing', 'active', 'past_due'))",
    )
  })

  it("does not introduce payment_required or disabled statuses", async () => {
    const sources = await Promise.all([
      readRepoFile("db/migrations/00008_create_orgs.sql"),
      readRepoFile("db/migrations/00010_create_users.sql"),
      readRepoFile("web/src/db/schemas/web/organizations.ts"),
      readRepoFile("web/src/db/schemas/web/users.ts"),
      readRepoFile("web/src/db-fns/web/billing.ts"),
    ])
    const combined = sources.join("\n")

    expect(combined).not.toContain("payment_required")
    expect(combined).not.toMatch(/billing_status[^;\n]*disabled/)
    expect(combined).not.toMatch(/billingStatus:\s*"disabled"/)
  })

  it("creates new individual accounts with a monthly billing anchor", async () => {
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

  it("activates billing without resetting existing billing anchors", async () => {
    const billingSource = await readRepoFile("web/src/db-fns/web/billing.ts")

    expect(billingSource).toContain("stripePaymentMethodId: paymentMethodId")
    expect(billingSource).toContain("billingStartedAt: sql`COALESCE(")
    expect(billingSource).toContain("nextPaymentAt: sql`COALESCE(")
    expect(billingSource).toContain('billingStatus: "active"')
  })

  it("copies billing state on individual-to-organization upgrade", async () => {
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
  const testEmail = `billing-test-${Date.now()}@example.com`

  function makeTestUserId() {
    return crypto.randomUUID()
  }

  async function createTestUser(id: string) {
    await db.insert(users).values({
      id,
      email: testEmail,
      displayName: "Billing Test User",
      role: "individual",
      billingStatus: "stripe_info_missing",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    setAuthenticated({ id, email: testEmail })
  }

  async function cleanupUser(id: string) {
    await db.delete(users).where(eq(users.id, id))
  }

  async function setupBilling(_userId: string) {
    const setupIntentId = `seti_${crypto.randomUUID().replace(/-/g, "")}`
    const result = await confirmSetupIntent({ data: { setupIntentId } })
    expect(result.success).toBe(true)
    return setupIntentId
  }

  it("getBillingAccount returns account info for user without stripe setup", async () => {
    const id = makeTestUserId()
    await createTestUser(id)
    try {
      const result = await getBillingAccount()
      expect(result.type).toBe("individual")
      expect(result.stripeCustomerId).toBeNull()
      expect(result.stripePaymentMethodId).toBeNull()
      expect(result.paymentMethods).toEqual([])
    } finally {
      await cleanupUser(id)
    }
  })

  it("createSetupIntent creates a setup intent", async () => {
    const id = makeTestUserId()
    await createTestUser(id)
    try {
      const result = await createSetupIntent()
      expect(result.clientSecret).toBeDefined()
      expect(typeof result.clientSecret).toBe("string")
    } finally {
      await cleanupUser(id)
    }
  })

  it("confirmSetupIntent activates billing for individual", async () => {
    const id = makeTestUserId()
    await createTestUser(id)
    try {
      const setupIntentId = `seti_${crypto.randomUUID().replace(/-/g, "")}`
      const result = await confirmSetupIntent({ data: { setupIntentId } })
      expect(result.success).toBe(true)

      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
      expect(user.billingStatus).toBe("active")
      expect(user.stripeCustomerId).toBeDefined()
      expect(user.stripePaymentMethodId).toBeDefined()
      expect(user.billingStartedAt).toBeDefined()
      expect(user.nextPaymentAt).toBeDefined()
    } finally {
      await cleanupUser(id)
    }
  })

  it("confirmSetupIntent throws when setup intent status is not succeeded", async () => {
    const id = makeTestUserId()
    await createTestUser(id)
    try {
      const setupIntentId = `seti_${crypto.randomUUID().replace(/-/g, "")}`
      mockStripeForceSetupIntentStatus(setupIntentId, "requires_payment_method")
      await expect(confirmSetupIntent({ data: { setupIntentId } })).rejects.toThrow(
        "Payment method setup has not succeeded",
      )
    } finally {
      await cleanupUser(id)
    }
  })

  it("setDefaultPaymentMethod updates default payment method", async () => {
    const id = makeTestUserId()
    await createTestUser(id)
    try {
      await setupBilling(id)

      const secondSetupIntentId = `seti_${crypto.randomUUID().replace(/-/g, "")}`
      await confirmSetupIntent({ data: { setupIntentId: secondSetupIntentId } })
      const [user2] = await db.select().from(users).where(eq(users.id, id)).limit(1)
      const newPaymentMethodId = user2.stripePaymentMethodId
      if (!newPaymentMethodId) throw new Error("Expected payment method after second setup")

      const result = await setDefaultPaymentMethod({
        data: { paymentMethodId: newPaymentMethodId },
      })
      expect(result.success).toBe(true)

      const [user3] = await db.select().from(users).where(eq(users.id, id)).limit(1)
      expect(user3.stripePaymentMethodId).toBe(newPaymentMethodId)
      expect(user3.billingStatus).toBe("active")
    } finally {
      await cleanupUser(id)
    }
  })

  it("detachPaymentMethod removes a payment method", async () => {
    const id = makeTestUserId()
    await createTestUser(id)
    try {
      await setupBilling(id)

      const extraSetupIntentId = `seti_${crypto.randomUUID().replace(/-/g, "")}`
      await confirmSetupIntent({ data: { setupIntentId: extraSetupIntentId } })

      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
      const firstPaymentMethodId = user.stripePaymentMethodId
      if (!firstPaymentMethodId) throw new Error("Expected initial payment method")

      const [user2] = await db.select().from(users).where(eq(users.id, id)).limit(1)
      const secondPaymentMethodId = user2.stripePaymentMethodId
      if (!secondPaymentMethodId) throw new Error("Expected payment method after extra setup")
      expect(secondPaymentMethodId).not.toBe(firstPaymentMethodId)

      const result = await detachPaymentMethod({ data: { paymentMethodId: secondPaymentMethodId } })
      expect(result.success).toBe(true)
    } finally {
      await cleanupUser(id)
    }
  })

  it("upgradeIndividualToOrganization upgrades user to organization", async () => {
    const id = makeTestUserId()
    await createTestUser(id)
    try {
      await setupBilling(id)

      const result = await upgradeIndividualToOrganization()
      expect(result.organizationId).toBeDefined()
      expect(result.teamId).toBeDefined()

      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
      expect(user.role).toBe("admin")
      expect(user.organizationId).toBe(result.organizationId)
      expect(user.stripeCustomerId).toBeNull()
      expect(user.stripePaymentMethodId).toBeNull()
      expect(user.billingStatus).toBe("stripe_info_missing")
    } finally {
      await cleanupUser(id)
    }
  })

  it("inviteOrganizationUser throws for non-admin", async () => {
    const id = makeTestUserId()
    await createTestUser(id)
    try {
      await expect(
        inviteOrganizationUser({
          data: {
            email: "new@example.com",
            role: "developer",
            teamIds: [crypto.randomUUID()],
          },
        }),
      ).rejects.toThrow("Only organization admins can invite users")
    } finally {
      await cleanupUser(id)
    }
  })
})
