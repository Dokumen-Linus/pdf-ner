import { createServerFn } from "@tanstack/react-start"
import { and, eq, gte, sql } from "drizzle-orm"
import Stripe from "stripe"
import { z } from "zod"

import { db } from "@/db/client"
import { authMembers } from "@/db/schemas/auth"
import { models } from "@/db/schemas/public"
import { organizations, users } from "@/db/schemas/web"
import { llmUsage, llmUsageReportBatches } from "@/db/schemas/workers"
import { env } from "@/env.server"
import { requireProjectPermission } from "@/lib/role-authorization.server"

const getStripe = () => new Stripe(env.STRIPE_SECRET_KEY)

const BillingProjectInput = z.object({ projectId: z.string().uuid() })

async function resolveBillingTarget(projectId: string) {
  const access = await requireProjectPermission(projectId, "billing")

  if (access.organizationId) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, access.organizationId))
      .limit(1)
    if (!org) {
      throw new Error("Organization billing profile not found")
    }
    return { access, kind: "organization" as const, organizationId: access.organizationId, org }
  }

  const [user] = await db.select().from(users).where(eq(users.id, access.userId)).limit(1)
  if (!user) {
    throw new Error("User billing profile not found")
  }
  return { access, kind: "user" as const, userId: access.userId, user }
}

async function ensureStripeCustomerForTarget(
  target: Awaited<ReturnType<typeof resolveBillingTarget>>,
) {
  const stripe = getStripe()
  if (target.kind === "organization") {
    if (target.org.stripeCustomerId) return target.org.stripeCustomerId
    const customer = await stripe.customers.create({
      name: target.organizationId,
      metadata: { billing_kind: "organization", organization_id: target.organizationId },
    })
    await db
      .update(organizations)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(organizations.id, target.organizationId))
    return customer.id
  }

  if (target.user.stripeCustomerId) return target.user.stripeCustomerId
  const customer = await stripe.customers.create({
    email: target.access.email,
    metadata: { billing_kind: "user", user_id: target.userId },
  })
  await db
    .update(users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(users.id, target.userId))
  return customer.id
}

async function getSeatQuantities(target: Awaited<ReturnType<typeof resolveBillingTarget>>) {
  if (target.kind === "user") {
    return { developers: 1, analysts: 0 }
  }

  const rows = await db
    .select({ role: authMembers.role, subscriptionType: users.subscriptionType })
    .from(authMembers)
    .innerJoin(users, eq(users.authUserId, authMembers.userId))
    .where(eq(authMembers.organizationId, target.organizationId))

  let developers = 0
  let analysts = 0
  for (const row of rows) {
    if (row.subscriptionType === "analyst" || row.role === "analyst") {
      analysts += 1
    } else {
      developers += 1
    }
  }
  return { developers: Math.max(developers, 1), analysts }
}

// ** READ **

export const getBillingOverview = createServerFn({ method: "GET" })
  .inputValidator(BillingProjectInput)
  .handler(async ({ data }) => {
    const target = await resolveBillingTarget(data.projectId)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const targetFilter =
      target.kind === "organization"
        ? eq(llmUsage.billingOrganizationId, target.organizationId)
        : eq(llmUsage.billingUserId, target.userId)

    const [totals] = await db
      .select({
        totalInputTokens: sql<number>`coalesce(sum(${llmUsage.inputTokens}), 0)::int`,
        totalOutputTokens: sql<number>`coalesce(sum(${llmUsage.outputTokens}), 0)::int`,
        totalCostUsd: sql<number>`coalesce(sum(${llmUsage.costUsd}::numeric), 0)`,
        callCount: sql<number>`count(*)::int`,
        unreportedCount: sql<number>`count(*) filter (where ${llmUsage.reportBatchId} is null)::int`,
      })
      .from(llmUsage)
      .where(and(targetFilter, gte(llmUsage.createdAt, startOfMonth)))

    const byModel = await db
      .select({
        provider: models.provider,
        model: llmUsage.modelId,
        inputTokens: sql<number>`coalesce(sum(${llmUsage.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${llmUsage.outputTokens}), 0)::int`,
        costUsd: sql<number>`coalesce(sum(${llmUsage.costUsd}::numeric), 0)`,
        callCount: sql<number>`count(*)::int`,
      })
      .from(llmUsage)
      .innerJoin(models, eq(llmUsage.modelId, models.id))
      .where(and(targetFilter, gte(llmUsage.createdAt, startOfMonth)))
      .groupBy(models.provider, llmUsage.modelId)
      .orderBy(sql`sum(${llmUsage.costUsd}::numeric) desc`)

    const batches = await db
      .select()
      .from(llmUsageReportBatches)
      .where(
        target.kind === "organization"
          ? eq(llmUsageReportBatches.billingOrganizationId, target.organizationId)
          : eq(llmUsageReportBatches.billingUserId, target.userId),
      )
      .orderBy(sql`${llmUsageReportBatches.createdAt} desc`)
      .limit(10)

    const billingRecord = target.kind === "organization" ? target.org : target.user

    return {
      targetKind: target.kind,
      billingUserId: target.kind === "user" ? target.userId : null,
      billingOrganizationId: target.kind === "organization" ? target.organizationId : null,
      stripeCustomerId: billingRecord.stripeCustomerId,
      stripeSubscriptionId: billingRecord.stripeSubscriptionId,
      stripeSubscriptionStatus: billingRecord.stripeSubscriptionStatus,
      totalInputTokens: totals?.totalInputTokens ?? 0,
      totalOutputTokens: totals?.totalOutputTokens ?? 0,
      totalCostUsd: Number(totals?.totalCostUsd ?? 0),
      callCount: totals?.callCount ?? 0,
      unreportedCount: totals?.unreportedCount ?? 0,
      byModel: byModel.map((r) => ({ ...r, costUsd: Number(r.costUsd) })),
      batches: batches.map((batch) => ({
        ...batch,
        costUsd: Number(batch.costUsd),
        inputTokens: Number(batch.inputTokens),
        outputTokens: Number(batch.outputTokens),
      })),
    }
  })

// ** WRITE **

export const createBillingCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator(BillingProjectInput)
  .handler(async ({ data }) => {
    const target = await resolveBillingTarget(data.projectId)
    const customerId = await ensureStripeCustomerForTarget(target)
    const seats = await getSeatQuantities(target)
    const stripe = getStripe()

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      success_url: `${env.BETTER_AUTH_URL}/billing?projectId=${data.projectId}`,
      cancel_url: `${env.BETTER_AUTH_URL}/billing?projectId=${data.projectId}`,
      line_items: [
        { price: env.STRIPE_DEVELOPER_PRICE_ID, quantity: seats.developers },
        ...(seats.analysts > 0
          ? [{ price: env.STRIPE_ANALYST_PRICE_ID, quantity: seats.analysts }]
          : []),
        { price: env.STRIPE_USAGE_PRICE_ID },
      ],
      subscription_data: {
        metadata:
          target.kind === "organization"
            ? { billing_kind: "organization", organization_id: target.organizationId }
            : { billing_kind: "user", user_id: target.userId },
      },
    })

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL")
    }
    return { url: session.url }
  })

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .inputValidator(BillingProjectInput)
  .handler(async ({ data }) => {
    const target = await resolveBillingTarget(data.projectId)
    const customerId = await ensureStripeCustomerForTarget(target)
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.BETTER_AUTH_URL}/billing?projectId=${data.projectId}`,
    })
    return { url: session.url }
  })
