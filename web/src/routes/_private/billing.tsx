import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { CreditCardIcon, ExternalLinkIcon, LoaderCircleIcon, ZapIcon } from "lucide-react"
import { z } from "zod"

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
import { getAccessibleProjects } from "@/db-fns/web/projects"
import {
  createBillingCheckoutSession,
  createBillingPortalSession,
  getBillingOverview,
} from "@/db-fns/workers/billing"
import { m } from "@/integrations/paraglide/messages.js"

const BillingSearchSchema = z.object({
  projectId: z.string().uuid().optional(),
})

export const Route = createFileRoute("/_private/billing")({
  validateSearch: BillingSearchSchema,
  loaderDeps: ({ search }) => ({ projectId: search.projectId }),
  loader: async ({ deps }) => {
    const projects = await getAccessibleProjects()
    const projectId = deps.projectId ?? projects[0]?.id ?? null
    if (!projectId) {
      return { projectId: null, overview: null, loadError: "Create a project before billing." }
    }
    try {
      const overview = await getBillingOverview({ data: { projectId } })
      return { projectId, overview, loadError: null as string | null }
    } catch (error) {
      return {
        projectId,
        overview: null,
        loadError: error instanceof Error ? error.message : String(error),
      }
    }
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
  if (lower === "gemini") {
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
        {sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function BillingPage() {
  const { projectId, overview, loadError } = Route.useLoaderData()
  const totalTokens = overview ? overview.totalInputTokens + overview.totalOutputTokens : 0
  const [action, setAction] = useState<"checkout" | "portal" | null>(null)

  async function openCheckout() {
    if (!projectId) return
    setAction("checkout")
    try {
      const { url } = await createBillingCheckoutSession({ data: { projectId } })
      window.location.assign(url)
    } finally {
      setAction(null)
    }
  }

  async function openPortal() {
    if (!projectId) return
    setAction("portal")
    try {
      const { url } = await createBillingPortalSession({ data: { projectId } })
      window.location.assign(url)
    } finally {
      setAction(null)
    }
  }

  if (loadError || !overview || !projectId) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{m.billing_title()}</h1>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Billing unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">{loadError ?? "Unable to load billing."}</p>
            <Button variant="outline" asChild>
              <Link to="/projects">Back to projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{m.billing_title()}</h1>
        <p className="text-muted-foreground text-sm">{m.billing_description()}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{m.billing_usage_title()}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatCard
            label={m.billing_usage_tokens_title()}
            value={totalTokens.toLocaleString()}
            sub={m.billing_usage_tokens_description({
              input: overview.totalInputTokens.toLocaleString(),
              output: overview.totalOutputTokens.toLocaleString(),
            })}
          />
          <StatCard
            label={m.billing_usage_cost_title()}
            value={formatCost(overview.totalCostUsd)}
            sub="Unreported usage is batched to Stripe."
          />
          <StatCard label={m.billing_usage_calls_title()} value={overview.callCount.toLocaleString()} />
          <StatCard label="Unreported" value={overview.unreportedCount.toLocaleString()} />
        </div>
      </section>

      {overview.byModel.length > 0 && (
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
                  {overview.byModel.map((row) => (
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

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{m.billing_sub_title()}</h2>
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ZapIcon className="text-muted-foreground h-5 w-5" />
              <CardTitle className="text-base">
                {overview.stripeSubscriptionId
                  ? m.billing_sub_status_active()
                  : m.billing_sub_status_inactive()}
              </CardTitle>
            </div>
            <CardDescription>
              {overview.targetKind === "organization"
                ? "This project bills to its organization."
                : "This project bills to your personal developer subscription."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => void openCheckout()} disabled={action !== null}>
              {action === "checkout" ? (
                <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCardIcon className="mr-2 h-4 w-4" />
              )}
              Start checkout
            </Button>
            <Button variant="outline" onClick={() => void openPortal()} disabled={action !== null}>
              {action === "portal" ? (
                <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLinkIcon className="mr-2 h-4 w-4" />
              )}
              Manage subscription
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
