import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import {
  chargeCurrentBillingCycle,
  createDirectTestPayment,
  getUatBillingTaskStatus,
  loadUatBillingTarget,
  runDueAccountBillingSweep,
  type UatTaskStatus,
} from "@/api-fns/uat-billing"
import { CreditCardIcon, LoaderCircleIcon, PlayIcon, RefreshCwIcon } from "@/components/icons"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn-ui/card"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"

export const Route = createFileRoute("/_private/uat/stripe")({
  loader: async () => {
    const target = await loadUatBillingTarget()
    return { target }
  },
  component: UatStripePage,
})

type TrackedTask = {
  taskId: string
  action: string
}

function formatJson(value: unknown) {
  if (value == null) return ""
  return JSON.stringify(value, null, 2)
}

function UatStripePage() {
  const { target } = Route.useLoaderData()
  const [amountDollars, setAmountDollars] = useState("1.00")
  const [sweepLimit, setSweepLimit] = useState(100)
  const [trackedTask, setTrackedTask] = useState<TrackedTask | null>(null)
  const [error, setError] = useState<string | null>(null)
  const publishableTestMode = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_")
  const actionsEnabled =
    publishableTestMode && target.serverStripeTestMode && target.hasSavedPaymentMethod

  const statusQuery = useQuery<UatTaskStatus>({
    queryKey: ["uat-billing-task", trackedTask?.taskId],
    queryFn: () => getUatBillingTaskStatus({ data: { taskId: trackedTask!.taskId } }),
    enabled: Boolean(trackedTask?.taskId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "SUCCESS" || status === "FAILURE" ? false : 1500
    },
  })

  const directPayment = useMutation({
    mutationFn: async () => {
      const amountCents = Math.round(Number(amountDollars) * 100)
      return createDirectTestPayment({ data: { amountCents } })
    },
    onSuccess: (result) => {
      setError(null)
      setTrackedTask({ taskId: result.task_id, action: "Direct PaymentIntent" })
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  })

  const currentCycle = useMutation({
    mutationFn: () => chargeCurrentBillingCycle(),
    onSuccess: (result) => {
      setError(null)
      setTrackedTask({ taskId: result.task_id, action: "Current cycle charge" })
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  })

  const dueSweep = useMutation({
    mutationFn: () => runDueAccountBillingSweep({ data: { limit: sweepLimit } }),
    onSuccess: (result) => {
      setError(null)
      setTrackedTask({ taskId: result.task_id, action: "Due-account sweep" })
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  })

  const isBusy = directPayment.isPending || currentCycle.isPending || dueSweep.isPending
  const status = statusQuery.data

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">UAT Stripe</h1>
          <p className="text-muted-foreground text-sm">
            Trigger test-mode billing tasks through FastAPI and Celery.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={publishableTestMode ? "secondary" : "destructive"}>publishable</Badge>
          <Badge variant={target.serverStripeTestMode ? "secondary" : "destructive"}>secret</Badge>
          <Badge variant={target.hasSavedPaymentMethod ? "secondary" : "outline"}>
            payment method
          </Badge>
        </div>
      </div>

      {error && (
        <div className="border-destructive/35 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCardIcon className="h-4 w-4" />
              Direct PaymentIntent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uat-direct-amount">Amount</Label>
              <Input
                id="uat-direct-amount"
                inputMode="decimal"
                value={amountDollars}
                onChange={(event) => setAmountDollars(event.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!actionsEnabled || isBusy}
              onClick={() => directPayment.mutate()}
            >
              {directPayment.isPending ? (
                <LoaderCircleIcon className="h-4 w-4 animate-spin" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
              Run direct payment
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCwIcon className="h-4 w-4" />
              Current Cycle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              disabled={!actionsEnabled || isBusy}
              onClick={() => currentCycle.mutate()}
            >
              {currentCycle.isPending ? (
                <LoaderCircleIcon className="h-4 w-4 animate-spin" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
              Charge current account
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCwIcon className="h-4 w-4" />
              Due Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uat-sweep-limit">Limit</Label>
              <Input
                id="uat-sweep-limit"
                type="number"
                min={1}
                max={500}
                value={sweepLimit}
                onChange={(event) => setSweepLimit(Number(event.target.value))}
              />
            </div>
            <Button
              className="w-full"
              disabled={!actionsEnabled || isBusy}
              onClick={() => dueSweep.mutate()}
            >
              {dueSweep.isPending ? (
                <LoaderCircleIcon className="h-4 w-4 animate-spin" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
              Run sweep
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Task Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trackedTask ? (
            <>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-muted-foreground">Task ID</div>
                  <div className="font-mono break-all">{trackedTask.taskId}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Action</div>
                  <div>{trackedTask.action}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div>{statusQuery.isFetching ? "polling" : (status?.status ?? "queued")}</div>
                </div>
              </div>
              {(status?.result || status?.error) && (
                <pre className="bg-muted max-h-80 overflow-auto rounded-md p-3 text-xs">
                  {formatJson(status.result ?? { error: status.error })}
                </pre>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No task has been started.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
