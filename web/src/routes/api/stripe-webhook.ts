import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import Stripe from "stripe"

import { db } from "@/db/client"
import { organizations, users } from "@/db/schemas/web"
import { env } from "@/env.server"

const stripe = new Stripe(env.STRIPE_SECRET_KEY)

function unixToDate(value: unknown): Date | null {
  return typeof value === "number" ? new Date(value * 1000) : null
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const subscriptionPeriods = subscription as unknown as {
    current_period_start?: number
    current_period_end?: number
  }
  const {
    billing_kind: billingKind,
    user_id: userId,
    organization_id: organizationId,
  } = subscription.metadata
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id

  const values = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripeSubscriptionStatus: subscription.status,
    stripeCurrentPeriodStart: unixToDate(subscriptionPeriods.current_period_start),
    stripeCurrentPeriodEnd: unixToDate(subscriptionPeriods.current_period_end),
    updatedAt: new Date(),
  }

  if (billingKind === "organization" && organizationId) {
    await db.update(organizations).set(values).where(eq(organizations.id, organizationId))
    return
  }

  if (billingKind === "user" && userId) {
    await db.update(users).set(values).where(eq(users.id, userId))
  }
}

async function clearSubscription(subscription: Stripe.Subscription) {
  const {
    billing_kind: billingKind,
    user_id: userId,
    organization_id: organizationId,
  } = subscription.metadata
  const values = {
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: subscription.status,
    stripeCurrentPeriodStart: null,
    stripeCurrentPeriodEnd: null,
    updatedAt: new Date(),
  }

  if (billingKind === "organization" && organizationId) {
    await db.update(organizations).set(values).where(eq(organizations.id, organizationId))
    return
  }

  if (billingKind === "user" && userId) {
    await db.update(users).set(values).where(eq(users.id, userId))
  }
}

export async function stripeWebhookHandler({ request }: { request: Request }) {
  const payload = await request.text()
  const signature = request.headers.get("stripe-signature")

  let event: Stripe.Event
  if (env.STRIPE_WEBHOOK_SECRET) {
    if (!signature) {
      return Response.json({ detail: "Missing Stripe signature" }, { status: 400 })
    }
    try {
      event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET)
    } catch (error) {
      return Response.json(
        { detail: error instanceof Error ? error.message : "Invalid Stripe signature" },
        { status: 400 },
      )
    }
  } else {
    event = JSON.parse(payload) as Stripe.Event
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      if (typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(session.subscription)
        await syncSubscription(subscription)
      }
      break
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await syncSubscription(event.data.object as Stripe.Subscription)
      break
    case "customer.subscription.deleted":
      await clearSubscription(event.data.object as Stripe.Subscription)
      break
  }

  return Response.json({ received: true })
}

export const Route = createFileRoute("/api/stripe-webhook" as never)({
  server: {
    handlers: {
      POST: stripeWebhookHandler,
    },
  },
})
