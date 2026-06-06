import { z } from "zod"

import { createMonitoredApiFn } from "@/db-fns/web/monitoring"

import type { AccountTarget } from "@/db-fns/web/billing-target"

type UatTaskResponse = { task_id: string }

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type UatTaskStatus = {
  task_id: string
  status: string
  metadata: {
    action: string
    account_type?: "individual" | "organization"
    account_id?: string
    amount_cents?: number
    limit?: number
  } | null
  progress?: JsonValue
  result?: JsonValue
  error?: string
}

async function assertTestStripeMode() {
  const { env } = await import("@/env.server")
  if (!env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
    throw new Error("UAT Stripe actions require a Stripe test secret key")
  }
}

async function isServerStripeTestMode() {
  const { env } = await import("@/env.server")
  return env.STRIPE_SECRET_KEY.startsWith("sk_test_")
}

function targetPayload(target: AccountTarget) {
  return target.type === "individual"
    ? { account_type: "individual" as const, account_id: target.userId }
    : { account_type: "organization" as const, account_id: target.organizationId }
}

function ensureSavedPaymentMethod(target: AccountTarget) {
  if (!target.customerId || !target.paymentMethodId) {
    throw new Error("Add a saved Stripe payment method before running UAT billing actions")
  }
}

async function requireUatBillingTarget() {
  const { requireBillingAccountTarget } = await import("@/db-fns/web/billing.server")
  const target = await requireBillingAccountTarget()
  ensureSavedPaymentMethod(target)
  return target
}

async function callWorkerApi(path: string, init?: RequestInit) {
  const { jsonCall } = await import("./api-json-call.server")
  return jsonCall(path, init)
}

function assertStatusBelongsToTarget(status: UatTaskStatus, target: AccountTarget) {
  if (!status.metadata) {
    throw new Error("Task not found or expired")
  }
  if (status.metadata.account_type || status.metadata.account_id) {
    const expected = targetPayload(target)
    if (
      status.metadata.account_type !== expected.account_type ||
      status.metadata.account_id !== expected.account_id
    ) {
      throw new Error("Task does not belong to the current billing account")
    }
  }
}

export const loadUatBillingTarget = createMonitoredApiFn({ eventName: "api.uat_billing.load_uat_billing_target", method: "GET" }).handler(async () => {
  const { requireBillingAccountTarget } = await import("@/db-fns/web/billing.server")
  const target = await requireBillingAccountTarget()
  return {
    ...targetPayload(target),
    stripeCustomerId: target.customerId,
    stripePaymentMethodId: target.paymentMethodId,
    hasSavedPaymentMethod: Boolean(target.customerId && target.paymentMethodId),
    serverStripeTestMode: await isServerStripeTestMode(),
  }
})

export const createDirectTestPayment = createMonitoredApiFn({ eventName: "api.uat_billing.create_direct_test_payment", method: "POST" })
  .inputValidator(z.object({ amountCents: z.number().int().min(50).max(50000).default(100) }))
  .handler(async ({ data }) => {
    await assertTestStripeMode()
    const target = await requireUatBillingTarget()
    return callWorkerApi("/api/v1/uat-worker-dispatch/billing/direct-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...targetPayload(target),
        amount_cents: data.amountCents,
      }),
    }) as Promise<UatTaskResponse>
  })

export const chargeCurrentBillingCycle = createMonitoredApiFn({ eventName: "api.uat_billing.charge_current_billing_cycle", method: "POST" }).handler(async () => {
  await assertTestStripeMode()
  const target = await requireUatBillingTarget()
  return callWorkerApi("/api/v1/uat-worker-dispatch/billing/current-cycle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(targetPayload(target)),
  }) as Promise<UatTaskResponse>
})

export const runDueAccountBillingSweep = createMonitoredApiFn({ eventName: "api.uat_billing.run_due_account_billing_sweep", method: "POST" })
  .inputValidator(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
  .handler(async ({ data }) => {
    await assertTestStripeMode()
    await requireUatBillingTarget()
    return callWorkerApi("/api/v1/uat-worker-dispatch/billing/due-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: data.limit }),
    }) as Promise<UatTaskResponse>
  })

export const getUatBillingTaskStatus = createMonitoredApiFn({ eventName: "api.uat_billing.get_task_status", method: "GET" })
  .inputValidator(z.object({ taskId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const target = await requireUatBillingTarget()
    const status = (await callWorkerApi(
      `/api/v1/uat-worker-dispatch/tasks/${data.taskId}/status`,
    )) as UatTaskStatus
    assertStatusBelongsToTarget(status, target)
    return status
  })
