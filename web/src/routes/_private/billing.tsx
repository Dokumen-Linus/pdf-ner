import { useMemo, useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { CreditCardIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/shadcn-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn-ui/card"
import {
  confirmSetupIntent,
  createSetupIntent,
  detachPaymentMethod,
  getBillingAccount,
  setDefaultPaymentMethod,
} from "@/db-fns/web/billing"
import { env } from "@/env.client"

const BillingSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute("/_private/billing")({
  validateSearch: BillingSearchSchema,
  loader: async () => {
    const account = await getBillingAccount()
    return { account }
  },
  component: BillingPage,
})

function formatCard(method: {
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
}) {
  const brand = method.brand ? method.brand.toUpperCase() : "CARD"
  const last4 = method.last4 ? `**** ${method.last4}` : ""
  const exp =
    method.expMonth && method.expYear
      ? `${String(method.expMonth).padStart(2, "0")}/${method.expYear}`
      : ""
  return [brand, last4, exp].filter(Boolean).join(" ")
}

function BillingPage() {
  const { account } = Route.useLoaderData()
  const { redirect } = Route.useSearch()
  const router = useRouter()
  const stripePromise = useMemo(() => loadStripe(env.VITE_STRIPE_PUBLISHABLE_KEY), [])
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStartingSetup, setIsStartingSetup] = useState(false)
  const [busyMethodId, setBusyMethodId] = useState<string | null>(null)

  async function startSetup() {
    setIsStartingSetup(true)
    setError(null)
    try {
      const result = await createSetupIntent()
      setClientSecret(result.clientSecret)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsStartingSetup(false)
    }
  }

  async function makeDefault(paymentMethodId: string) {
    setBusyMethodId(paymentMethodId)
    setError(null)
    try {
      await setDefaultPaymentMethod({ data: { paymentMethodId } })
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyMethodId(null)
    }
  }

  async function remove(paymentMethodId: string) {
    setBusyMethodId(paymentMethodId)
    setError(null)
    try {
      await detachPaymentMethod({ data: { paymentMethodId } })
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyMethodId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Payment</h1>
        <p className="text-muted-foreground text-sm">
          Saved cards are used for monthly charges calculated in Dokumen.
        </p>
      </div>

      {error && (
        <div className="border-destructive/35 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Saved payment methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {account.paymentMethods.length === 0 ? (
            <p className="text-muted-foreground text-sm">Add a card before using the app.</p>
          ) : (
            account.paymentMethods.map((method) => (
              <div
                key={method.id}
                className="border-border/60 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2 text-sm">
                  <CreditCardIcon className="text-muted-foreground h-4 w-4" />
                  <span>{formatCard(method)}</span>
                  {method.isDefault && (
                    <span className="bg-muted rounded px-2 py-0.5 text-xs">Default</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!method.isDefault && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyMethodId === method.id}
                      onClick={() => void makeDefault(method.id)}
                    >
                      Use
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={busyMethodId === method.id}
                    onClick={() => void remove(method.id)}
                    aria-label="Remove payment method"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}

          <Button onClick={() => void startSetup()} disabled={isStartingSetup}>
            {isStartingSetup && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
            Add payment method
          </Button>
        </CardContent>
      </Card>

      {clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <SetupForm
            redirect={redirect}
            onError={setError}
            onSuccess={async () => {
              setClientSecret(null)
              await router.invalidate()
            }}
          />
        </Elements>
      )}

      {account.stripePaymentMethodId && redirect && (
        <Button asChild>
          <a href={redirect}>Continue</a>
        </Button>
      )}
    </div>
  )
}

function SetupForm({
  redirect,
  onError,
  onSuccess,
}: {
  redirect?: string
  onError: (message: string | null) => void
  onSuccess: () => Promise<void>
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setIsSubmitting(true)
    onError(null)
    try {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/billing${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`,
        },
        redirect: "if_required",
      })
      if (result.error) {
        onError(result.error.message ?? "Payment setup failed")
        return
      }
      if (!result.setupIntent?.id) {
        onError("Stripe did not return a setup intent")
        return
      }
      await confirmSetupIntent({ data: { setupIntentId: result.setupIntent.id } })
      await onSuccess()
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add card</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <PaymentElement />
          <Button type="submit" disabled={!stripe || isSubmitting}>
            {isSubmitting && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
            Save card
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
