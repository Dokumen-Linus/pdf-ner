import { useState } from "react"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { createFileRoute } from "@tanstack/react-router"
import { CreditCardIcon, LoaderCircleIcon, ZapIcon } from "lucide-react"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn-ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn-ui/table"
import { createSetupIntent, getStripeCustomer, getUsageSummary } from "@/db-fns/workers/billing"
import { env } from "@/env.client"

const stripePromise = loadStripe(env.VITE_STRIPE_PUBLISHABLE_KEY)

export const Route = createFileRoute("/_private/billing")({
  loader: async () => {
    const [{ clientSecret }, usage, stripeCustomer] = await Promise.all([
      createSetupIntent(),
      getUsageSummary(),
      getStripeCustomer(),
    ])
    return { clientSecret, usage, stripeCustomer }
  },
  component: BillingPage,
})

function formatCost(usd: number) {
  return `$${usd.toFixed(6)}`
}

function ProviderBadge({ provider }: { provider: string }) {
  const lower = provider.toLowerCase()
  if (lower === "anthropic") {
    return (
      <Badge className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-50">
        {provider}
      </Badge>
    )
  }
  if (lower === "openai") {
    return (
      <Badge className="border-green-200 bg-green-50 text-green-700 hover:bg-green-50">
        {provider}
      </Badge>
    )
  }
  if (lower === "google") {
    return (
      <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
        {provider}
      </Badge>
    )
  }
  return <Badge variant="outline">{provider}</Badge>
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function PaymentForm() {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [succeeded, setSucceeded] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsSubmitting(true)
    setError(null)

    const { error: stripeError } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/billing` },
      redirect: "if_required",
    })

    if (stripeError) {
      setError(stripeError.message ?? "Something went wrong. Please try again.")
      setIsSubmitting(false)
      return
    }

    setSucceeded(true)
    setIsSubmitting(false)
  }

  if (succeeded) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Payment method saved successfully.
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      <PaymentElement />
      {error && (
        <div className="rounded-md border border-destructive/35 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <Button type="submit" disabled={!stripe || isSubmitting} className="w-full">
        {isSubmitting && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? "Saving..." : "Save Payment Method"}
      </Button>
    </form>
  )
}

function BillingPage() {
  const { clientSecret, usage, stripeCustomer } = Route.useLoaderData()
  const totalTokens = usage ? usage.totalInputTokens + usage.totalOutputTokens : 0

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Billing & Usage</h1>
        <p className="text-sm text-muted-foreground">Current month usage and payment details.</p>
      </div>

      {/* Usage Summary */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Usage This Month</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Tokens"
            value={totalTokens.toLocaleString()}
            sub={
              usage
                ? `${usage.totalInputTokens.toLocaleString()} in / ${usage.totalOutputTokens.toLocaleString()} out`
                : undefined
            }
          />
          <StatCard
            label="Total Cost"
            value={usage ? formatCost(usage.totalCostUsd) : "$0.000000"}
          />
          <StatCard label="API Calls" value={(usage?.callCount ?? 0).toLocaleString()} />
        </div>
      </section>

      {/* Usage by Model */}
      {usage && usage.byModel.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Usage by Model</h2>
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Input Tokens</TableHead>
                    <TableHead className="text-right">Output Tokens</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.byModel.map((row) => (
                    <TableRow key={`${row.provider}-${row.model}`}>
                      <TableCell>
                        <ProviderBadge provider={row.provider} />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{row.model}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.inputTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.outputTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCost(row.costUsd)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.callCount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Stripe Status */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Subscription</h2>
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ZapIcon className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                {stripeCustomer?.stripeSubscriptionId
                  ? "Active Subscription"
                  : "No Active Subscription"}
              </CardTitle>
            </div>
            <CardDescription>
              {stripeCustomer?.stripeSubscriptionId
                ? "You are on a metered plan. Charges are based on actual usage."
                : "Subscribe to enable API access beyond the free tier."}
            </CardDescription>
          </CardHeader>
          {stripeCustomer?.stripeSubscriptionId && (
            <CardContent>
              <p className="font-mono text-xs text-muted-foreground">
                ID: {stripeCustomer.stripeSubscriptionId}
              </p>
            </CardContent>
          )}
        </Card>
      </section>

      {/* Payment Method */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Payment Method</h2>
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Payment Information</CardTitle>
            </div>
            <CardDescription>
              Your card details are secured by Stripe and never stored on our servers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm />
            </Elements>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
