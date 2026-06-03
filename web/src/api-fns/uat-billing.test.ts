import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import type { UatTaskStatus } from "./uat-billing"

type MockTarget =
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

type FetchCall = {
  url: string
  init?: RequestInit
  body?: unknown
}

let stripeSecretKey = "sk_test_dummy"
let target: MockTarget = {
  type: "individual",
  userId: "user-1",
  customerId: "cus_test",
  paymentMethodId: "pm_test",
}
let targetCalls = 0

mock.module("@/env.server", () => ({
  env: {
    get API_URL() {
      return "http://api.test"
    },
    get API_KEY() {
      return "test-api-key"
    },
    get STRIPE_SECRET_KEY() {
      return stripeSecretKey
    },
  },
}))

mock.module("@/db-fns/web/billing.server", () => ({
  requireBillingAccountTarget: async () => {
    targetCalls += 1
    return target
  },
}))

const {
  chargeCurrentBillingCycle,
  createDirectTestPayment,
  getUatBillingTaskStatus,
  loadUatBillingTarget,
  runDueAccountBillingSweep,
} = await import("./uat-billing")

const fetchCalls: FetchCall[] = []
let fetchResponse: Response
let originalFetch: typeof fetch

beforeEach(() => {
  stripeSecretKey = "sk_test_dummy"
  target = {
    type: "individual",
    userId: "user-1",
    customerId: "cus_test",
    paymentMethodId: "pm_test",
  }
  targetCalls = 0
  fetchCalls.length = 0
  originalFetch = globalThis.fetch
  fetchResponse = Response.json({ task_id: "task-1" })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const body =
      init?.body != null && typeof init.body === "string" ? JSON.parse(init.body) : init?.body
    fetchCalls.push({ url, init, body })
    return fetchResponse.clone()
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("UAT billing API functions", () => {
  it("loads the current billing target without calling the worker API", async () => {
    const result = await loadUatBillingTarget()

    expect(result).toEqual({
      account_type: "individual",
      account_id: "user-1",
      stripeCustomerId: "cus_test",
      stripePaymentMethodId: "pm_test",
      hasSavedPaymentMethod: true,
      serverStripeTestMode: true,
    })
    expect(targetCalls).toBe(1)
    expect(fetchCalls).toEqual([])
  })

  it("resolves current account target before dispatching direct payment", async () => {
    const result = await createDirectTestPayment({ data: { amountCents: 125 } })

    expect(result).toEqual({ task_id: "task-1" })
    expect(targetCalls).toBe(1)
    expect(fetchCalls[0].url).toBe(
      "http://api.test/api/v1/uat-worker-dispatch/billing/direct-payment",
    )
    expect(fetchCalls[0].init?.method).toBe("POST")
    expect(new Headers(fetchCalls[0].init?.headers).get("X-API-Key")).toBe("test-api-key")
    expect(fetchCalls[0].body).toEqual({
      account_type: "individual",
      account_id: "user-1",
      amount_cents: 125,
    })
  })

  it("dispatches current-cycle charge for organization target", async () => {
    target = {
      type: "organization",
      organizationId: "org-1",
      customerId: "cus_test",
      paymentMethodId: "pm_test",
    }

    await chargeCurrentBillingCycle()

    expect(fetchCalls[0].url).toBe(
      "http://api.test/api/v1/uat-worker-dispatch/billing/current-cycle",
    )
    expect(fetchCalls[0].body).toEqual({
      account_type: "organization",
      account_id: "org-1",
    })
  })

  it("dispatches due-account sweep after resolving billing target", async () => {
    await runDueAccountBillingSweep({ data: { limit: 20 } })

    expect(targetCalls).toBe(1)
    expect(fetchCalls[0].url).toBe(
      "http://api.test/api/v1/uat-worker-dispatch/billing/due-accounts",
    )
    expect(fetchCalls[0].body).toEqual({ limit: 20 })
  })

  it("blocks dispatch when server Stripe secret is not test mode", async () => {
    stripeSecretKey = "sk_live_dummy"

    await expect(createDirectTestPayment({ data: { amountCents: 100 } })).rejects.toThrow(
      "Stripe test secret key",
    )
    expect(targetCalls).toBe(0)
    expect(fetchCalls).toEqual([])
  })

  it("propagates API error details", async () => {
    fetchResponse = Response.json({ detail: "worker unavailable" }, { status: 503 })

    await expect(chargeCurrentBillingCycle()).rejects.toThrow("worker unavailable")
  })

  it("polls task status and validates account metadata", async () => {
    fetchResponse = Response.json({
      task_id: "task-1",
      status: "SUCCESS",
      metadata: {
        action: "direct_payment",
        account_type: "individual",
        account_id: "user-1",
      },
      result: { payment_intent_id: "pi_test" },
    })

    const result = (await getUatBillingTaskStatus({
      data: { taskId: "task-1" },
    })) as UatTaskStatus

    expect(result.status).toBe("SUCCESS")
    expect(fetchCalls[0].url).toBe("http://api.test/api/v1/uat-worker-dispatch/tasks/task-1/status")
  })
})
