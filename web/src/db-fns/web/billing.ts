import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db/client"
import { authMembers, authOrganizations, authTeamMembers, authTeams } from "@/db/schemas/auth"
import { organizations, projects, users, webTeams } from "@/db/schemas/web"
import { auth } from "@/lib/auth"
import { requireWorkspaceUser } from "@/lib/project-authorization.server"
import { getStripe } from "@/lib/stripe.server"

type AccountTarget =
  | {
      type: "individual"
      userId: string
      customerId: string | null
      paymentMethodId: string | null
    }
  | {
      type: "organization"
      organizationId: string
      customerId: string | null
      paymentMethodId: string | null
    }

async function requireAccountTarget(): Promise<AccountTarget> {
  const user = await requireWorkspaceUser()
  const [row] = await db
    .select({
      id: users.id,
      role: users.role,
      organizationId: users.organizationId,
      userStripeCustomerId: users.stripeCustomerId,
      userStripePaymentMethodId: users.stripePaymentMethodId,
      orgStripeCustomerId: organizations.stripeCustomerId,
      orgStripePaymentMethodId: organizations.stripePaymentMethodId,
    })
    .from(users)
    .leftJoin(organizations, eq(organizations.id, users.organizationId))
    .where(eq(users.id, user.userId))
    .limit(1)

  if (!row) throw new Error("User profile not found")
  if (
    (row.role === "admin" || row.role === "developer" || row.role === "analyst") &&
    row.organizationId
  ) {
    if (row.role !== "admin") throw new Error("Only admins can manage organization payment methods")
    return {
      type: "organization",
      organizationId: row.organizationId,
      customerId: row.orgStripeCustomerId,
      paymentMethodId: row.orgStripePaymentMethodId,
    }
  }
  return {
    type: "individual",
    userId: row.id,
    customerId: row.userStripeCustomerId,
    paymentMethodId: row.userStripePaymentMethodId,
  }
}

async function ensureStripeCustomer(target: AccountTarget) {
  if (target.customerId) return target.customerId
  const stripe = getStripe()
  const workspaceUser = await requireWorkspaceUser()
  const customer = await stripe.customers.create({
    email: workspaceUser.email,
    metadata:
      target.type === "individual"
        ? { account_type: "individual", user_id: target.userId }
        : { account_type: "organization", organization_id: target.organizationId },
  })

  if (target.type === "individual") {
    await db
      .update(users)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(users.id, target.userId))
  } else {
    await db
      .update(organizations)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(organizations.id, target.organizationId))
  }
  return customer.id
}

function oneMonthFrom(value: Date) {
  const next = new Date(value)
  next.setMonth(next.getMonth() + 1)
  return next
}

export const getBillingAccount = createServerFn({ method: "GET" }).handler(async () => {
  const target = await requireAccountTarget()
  const stripe = target.customerId ? getStripe() : null
  const paymentMethods =
    stripe && target.customerId
      ? await stripe.paymentMethods.list({ customer: target.customerId, type: "card" })
      : { data: [] }

  return {
    accountType: target.type,
    stripeCustomerId: target.customerId,
    stripePaymentMethodId: target.paymentMethodId,
    paymentMethods: paymentMethods.data.map((method) => ({
      id: method.id,
      brand: method.card?.brand ?? null,
      last4: method.card?.last4 ?? null,
      expMonth: method.card?.exp_month ?? null,
      expYear: method.card?.exp_year ?? null,
      isDefault: method.id === target.paymentMethodId,
    })),
  }
})

export const createSetupIntent = createServerFn({ method: "POST" }).handler(async () => {
  const target = await requireAccountTarget()
  const customerId = await ensureStripeCustomer(target)
  const setupIntent = await getStripe().setupIntents.create({
    customer: customerId,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata:
      target.type === "individual"
        ? { account_type: "individual", user_id: target.userId }
        : { account_type: "organization", organization_id: target.organizationId },
  })
  if (!setupIntent.client_secret) throw new Error("Stripe did not return a setup client secret")
  return { clientSecret: setupIntent.client_secret }
})

export const confirmSetupIntent = createServerFn({ method: "POST" })
  .inputValidator(z.object({ setupIntentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const target = await requireAccountTarget()
    const setupIntent = await getStripe().setupIntents.retrieve(data.setupIntentId)
    if (setupIntent.status !== "succeeded") {
      throw new Error("Payment method setup has not succeeded")
    }
    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id
    if (!paymentMethodId) throw new Error("SetupIntent did not include a payment method")

    const now = new Date()
    if (target.type === "individual") {
      await db
        .update(users)
        .set({
          stripeCustomerId:
            typeof setupIntent.customer === "string"
              ? setupIntent.customer
              : (setupIntent.customer?.id ?? target.customerId),
          stripePaymentMethodId: paymentMethodId,
          billingStartedAt: sql`COALESCE(${users.billingStartedAt}, ${now})`,
          nextPaymentAt: sql`COALESCE(${users.nextPaymentAt}, ${oneMonthFrom(now)})`,
          billingStatus: "active",
          billingFailureCount: 0,
          updatedAt: now,
        })
        .where(eq(users.id, target.userId))
    } else {
      await db
        .update(organizations)
        .set({
          stripeCustomerId:
            typeof setupIntent.customer === "string"
              ? setupIntent.customer
              : (setupIntent.customer?.id ?? target.customerId),
          stripePaymentMethodId: paymentMethodId,
          billingStartedAt: sql`COALESCE(${organizations.billingStartedAt}, ${now})`,
          nextPaymentAt: sql`COALESCE(${organizations.nextPaymentAt}, ${oneMonthFrom(now)})`,
          billingStatus: "active",
          billingFailureCount: 0,
          updatedAt: now,
        })
        .where(eq(organizations.id, target.organizationId))
    }
    return { success: true }
  })

export const setDefaultPaymentMethod = createServerFn({ method: "POST" })
  .inputValidator(z.object({ paymentMethodId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const target = await requireAccountTarget()
    const customerId = await ensureStripeCustomer(target)
    const method = await getStripe().paymentMethods.retrieve(data.paymentMethodId)
    const methodCustomer =
      typeof method.customer === "string" ? method.customer : method.customer?.id
    if (methodCustomer !== customerId)
      throw new Error("Payment method does not belong to this account")

    if (target.type === "individual") {
      await db
        .update(users)
        .set({
          stripePaymentMethodId: data.paymentMethodId,
          billingStatus: "active",
          updatedAt: new Date(),
        })
        .where(eq(users.id, target.userId))
    } else {
      await db
        .update(organizations)
        .set({
          stripePaymentMethodId: data.paymentMethodId,
          billingStatus: "active",
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, target.organizationId))
    }
    return { success: true }
  })

export const detachPaymentMethod = createServerFn({ method: "POST" })
  .inputValidator(z.object({ paymentMethodId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const target = await requireAccountTarget()
    const customerId = await ensureStripeCustomer(target)
    const methods = await getStripe().paymentMethods.list({ customer: customerId, type: "card" })
    if (methods.data.length <= 1) {
      throw new Error("You cannot remove the last saved payment method")
    }
    if (data.paymentMethodId === target.paymentMethodId) {
      throw new Error("Choose a different default payment method before removing this one")
    }
    await getStripe().paymentMethods.detach(data.paymentMethodId)
    return { success: true }
  })

export const upgradeIndividualToOrganization = createServerFn({ method: "POST" }).handler(
  async () => {
    const workspaceUser = await requireWorkspaceUser()
    const [user] = await db.select().from(users).where(eq(users.id, workspaceUser.userId)).limit(1)
    if (!user) throw new Error("User profile not found")
    if (user.role !== "individual") throw new Error("Only individual accounts can be upgraded")
    if (!user.stripeCustomerId || !user.stripePaymentMethodId) {
      throw new Error("Add payment information before upgrading")
    }

    const organizationId = crypto.randomUUID()
    const teamId = crypto.randomUUID()
    const createdAt = new Date()
    const orgName = user.displayName?.trim() || user.email.split("@")[0] || "Organization"
    const slug = `${
      orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "organization"
    }-${organizationId.slice(0, 8)}`

    await db.transaction(async (tx) => {
      await tx.insert(authOrganizations).values({
        id: organizationId,
        name: orgName,
        slug,
        createdAt,
        metadata: JSON.stringify({ upgradedFromUserId: user.id }),
      })
      await tx.insert(authMembers).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: workspaceUser.authUserId,
        role: "owner",
        createdAt,
      })
      await tx.insert(authTeams).values({
        id: teamId,
        name: "Default",
        organizationId,
        createdAt,
        updatedAt: createdAt,
      })
      await tx.insert(authTeamMembers).values({
        id: crypto.randomUUID(),
        teamId,
        userId: workspaceUser.authUserId,
        createdAt,
      })
      await tx.insert(organizations).values({
        id: organizationId,
        nUsers: 1,
        billingStartedAt: user.billingStartedAt,
        nextPaymentAt: user.nextPaymentAt,
        lastPaymentAt: user.lastPaymentAt,
        billingStatus: user.billingStatus,
        billingFailureCount: user.billingFailureCount,
        stripeCustomerId: user.stripeCustomerId,
        stripePaymentMethodId: user.stripePaymentMethodId,
        createdAt,
      })
      await tx.insert(webTeams).values({ id: teamId, organizationId, createdAt })
      await tx
        .update(projects)
        .set({ teamId, updatedAt: createdAt })
        .where(and(eq(projects.ownerId, user.id), isNull(projects.teamId)))
      await tx
        .update(users)
        .set({
          role: "admin",
          organizationId,
          stripeCustomerId: null,
          stripePaymentMethodId: null,
          billingStartedAt: null,
          nextPaymentAt: null,
          lastPaymentAt: null,
          billingStatus: "active",
          billingFailureCount: 0,
          updatedAt: createdAt,
        })
        .where(eq(users.id, user.id))
    })
    return { organizationId, teamId }
  },
)

export const inviteOrganizationUser = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.email(),
      role: z.enum(["admin", "developer", "analyst"]),
      teamIds: z.array(z.string()).min(1),
    }),
  )
  .handler(async ({ data }) => {
    const workspaceUser = await requireWorkspaceUser()
    const [admin] = await db
      .select({ organizationId: users.organizationId, role: users.role })
      .from(users)
      .where(eq(users.id, workspaceUser.userId))
      .limit(1)
    if (!admin?.organizationId || admin.role !== "admin") {
      throw new Error("Only organization admins can invite users")
    }

    const teams = await db
      .select({ id: webTeams.id })
      .from(webTeams)
      .where(
        and(eq(webTeams.organizationId, admin.organizationId), inArray(webTeams.id, data.teamIds)),
      )
    if (teams.length !== data.teamIds.length) throw new Error("One or more teams are invalid")

    const headers = getRequestHeaders()
    await auth.api.createInvitation({
      headers,
      body: {
        email: data.email,
        role: data.role,
        organizationId: admin.organizationId,
        teamId: data.teamIds[0],
      },
    })
    return { success: true }
  })
