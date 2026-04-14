import { useState } from "react"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { createFileRoute } from "@tanstack/react-router"
import { m } from "@/integrations/paraglide/messages.js"
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
      setError(stripeError.message ?? m.billing_payment_error_fallback())
      setIsSubmitting(false)
      return
    }

    setSucceeded(true)
    setIsSubmitting(false)
  }

  if (succeeded) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        {m.billing_payment_success()}
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
        {isSubmitting ? m.billing_payment_button_loading() : m.billing_payment_button()}
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
        <h1 className="text-3xl font-semibold tracking-tight">{m.billing_title()}</h1>
        <p className="text-sm text-muted-foreground">{m.billing_description()}</p>
      </div>

      {/* Usage Summary */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">{m.billing_usage_title()}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Base Fee" value="$5.00" sub="Monthly workspace subscription" />
          <StatCard
            label={m.billing_usage_tokens_title()}
            value={totalTokens.toLocaleString()}
            sub={
              usage
                ? m.billing_usage_tokens_description({ input: usage.totalInputTokens.toLocaleString(), output: usage.totalOutputTokens.toLocaleString() })
                : undefined
            }
          />
          <StatCard
            label={m.billing_usage_cost_title()}
            value={usage ? formatCost(usage.totalCostUsd) : "$0.000000"}
            sub="Metered usage only"
          />
          <StatCard label={m.billing_usage_calls_title()} value={(usage?.callCount ?? 0).toLocaleString()} />
        </div>
      </section>

      {/* Usage by Model */}
      {usage && usage.byModel.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">{m.billing_model_usage_title()}</h2>
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.billing_table_col_provider()}</TableHead>
                    <TableHead>{m.billing_table_col_model()}</TableHead>
                    <TableHead className="text-right">{m.billing_table_col_input()}</TableHead>
                    <TableHead className="text-right">{m.billing_table_col_output()}</TableHead>
                    <TableHead className="text-right">{m.billing_table_col_cost()}</TableHead>
                    <TableHead className="text-right">{m.billing_table_col_calls()}</TableHead>
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
        <h2 className="text-lg font-medium">{m.billing_sub_title()}</h2>
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ZapIcon className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                {stripeCustomer?.stripeSubscriptionId
                  ? m.billing_sub_status_active()
                  : m.billing_sub_status_inactive()}
              </CardTitle>
            </div>
            <CardDescription>
              {stripeCustomer?.stripeSubscriptionId
                ? m.billing_sub_description_active()
                : m.billing_sub_description_inactive()}
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
        <h2 className="text-lg font-medium">{m.billing_payment_title()}</h2>
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">{m.billing_payment_subtitle()}</CardTitle>
            </div>
            <CardDescription>
              {m.billing_payment_description()}
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
