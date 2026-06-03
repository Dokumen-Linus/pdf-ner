import { eq } from "drizzle-orm"

import { db } from "@/db/client"
import { organizations, users } from "@/db/schemas/web"
import { requireWorkspaceUser } from "@/lib/project-authorization.server"
import { getStripe } from "@/lib/stripe.server"

import type { AccountTarget } from "./billing"

export async function requireBillingAccountTarget(): Promise<AccountTarget> {
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

export async function ensureStripeCustomer(target: AccountTarget) {
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
