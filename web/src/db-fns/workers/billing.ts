import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { and, eq, gte, sql } from "drizzle-orm"
import Stripe from "stripe"
import { z } from "zod"

import { db } from "@/db/client"
import { llmUsage, stripeCustomers } from "@/db/schemas/workers"
import { env } from "@/env.server"
import { auth } from "@/lib/auth"

const getStripe = () => new Stripe(env.STRIPE_SECRET_KEY)

async function requireUserId(): Promise<string> {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session.user.id
}

// ** READ **

export const getUsageSummary = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [totals] = await db
    .select({
      totalInputTokens: sql<number>`coalesce(sum(${llmUsage.inputTokens}), 0)::int`,
      totalOutputTokens: sql<number>`coalesce(sum(${llmUsage.outputTokens}), 0)::int`,
      totalCostUsd: sql<number>`coalesce(sum(${llmUsage.costUsd}::numeric), 0)`,
      callCount: sql<number>`count(*)::int`,
    })
    .from(llmUsage)
    .where(and(eq(llmUsage.userId, userId), gte(llmUsage.createdAt, startOfMonth)))

  const byModel = await db
    .select({
      provider: llmUsage.provider,
      model: llmUsage.model,
      inputTokens: sql<number>`coalesce(sum(${llmUsage.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${llmUsage.outputTokens}), 0)::int`,
      costUsd: sql<number>`coalesce(sum(${llmUsage.costUsd}::numeric), 0)`,
      callCount: sql<number>`count(*)::int`,
    })
    .from(llmUsage)
    .where(and(eq(llmUsage.userId, userId), gte(llmUsage.createdAt, startOfMonth)))
    .groupBy(llmUsage.provider, llmUsage.model)
    .orderBy(sql`sum(${llmUsage.costUsd}::numeric) desc`)

  const byDay = await db
    .select({
      date: sql<string>`date(${llmUsage.createdAt})::text`,
      inputTokens: sql<number>`coalesce(sum(${llmUsage.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${llmUsage.outputTokens}), 0)::int`,
      costUsd: sql<number>`coalesce(sum(${llmUsage.costUsd}::numeric), 0)`,
    })
    .from(llmUsage)
    .where(and(eq(llmUsage.userId, userId), gte(llmUsage.createdAt, startOfMonth)))
    .groupBy(sql`date(${llmUsage.createdAt})`)
    .orderBy(sql`date(${llmUsage.createdAt}) asc`)

  return {
    totalInputTokens: totals?.totalInputTokens ?? 0,
    totalOutputTokens: totals?.totalOutputTokens ?? 0,
    totalCostUsd: Number(totals?.totalCostUsd ?? 0),
    callCount: totals?.callCount ?? 0,
    byModel: byModel.map((r) => ({ ...r, costUsd: Number(r.costUsd) })),
    byDay: byDay.map((r) => ({ ...r, costUsd: Number(r.costUsd) })),
  }
})

export const getStripeCustomer = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId()
  const [customer] = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, userId))
    .limit(1)
  return customer ?? null
})

// ** WRITE **

export const ensureStripeCustomer = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), name: z.string().optional() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()

    const existing = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId))
      .limit(1)

    if (existing[0]) {
      return existing[0]
    }

    const stripe = getStripe()
    const customer = await stripe.customers.create({
      email: data.email,
      name: data.name,
      metadata: { userId },
    })

    const [row] = await db
      .insert(stripeCustomers)
      .values({
        userId,
        stripeCustomerId: customer.id,
      })
      .onConflictDoUpdate({
        target: stripeCustomers.userId,
        set: { stripeCustomerId: customer.id, updatedAt: new Date() },
      })
      .returning()

    return row
  })

export const createSetupIntent = createServerFn({ method: "POST" }).handler(async () => {
  const userId = await requireUserId()

  const [customer] = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, userId))
    .limit(1)

  if (!customer) {
    throw new Error("Stripe customer not found. Call ensureStripeCustomer first.")
  }

  const stripe = getStripe()
  const setupIntent = await stripe.setupIntents.create({
    customer: customer.stripeCustomerId,
    payment_method_types: ["card"],
  })
  if (!setupIntent.client_secret) {
    throw new Error("Stripe did not return a client secret")
  }
  return { clientSecret: setupIntent.client_secret }
})

export const createMeteredSubscription = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      usagePriceId: z.string(),
      basePriceId: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId()

    const [customer] = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId))
      .limit(1)

    if (!customer) {
      throw new Error("Stripe customer not found. Call ensureStripeCustomer first.")
    }

    const stripe = getStripe()
    const subscription = await stripe.subscriptions.create({
      customer: customer.stripeCustomerId,
      items: [
        ...(data.basePriceId ? [{ price: data.basePriceId }] : []),
        { price: data.usagePriceId },
      ],
    })

    const item =
      subscription.items.data.find((candidate) => candidate.price?.id === data.usagePriceId) ??
      subscription.items.data[subscription.items.data.length - 1]
    if (!item) {
      throw new Error("Stripe subscription created but has no items")
    }

    await db
      .update(stripeCustomers)
      .set({
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionItemId: item.id,
        updatedAt: new Date(),
      })
      .where(eq(stripeCustomers.userId, userId))

    return { subscriptionId: subscription.id, itemId: item.id }
  })
