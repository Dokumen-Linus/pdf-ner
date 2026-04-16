import { createFileRoute, Link } from "@tanstack/react-router"
import { CheckIcon } from "lucide-react"
import { getAllModels } from "@/db-fns/public/models"
import type { FoundModel } from "@/db/types"

type ProviderSlug = "anthropic" | "openai" | "google"

type ProviderDisplay = {
  slug: ProviderSlug
  name: string
  color: string
  bg: string
  border: string
}

const PROVIDER_DISPLAY: Record<ProviderSlug, ProviderDisplay> = {
  anthropic: {
    slug: "anthropic",
    name: "Anthropic",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  openai: {
    slug: "openai",
    name: "OpenAI",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  google: {
    slug: "google",
    name: "Google",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
}

// The three values above mirror the CHECK constraint on public.models.provider
// (db/migrations/00091_create_models.sql). Unknown providers are filtered out.
const PROVIDER_ORDER: ProviderSlug[] = ["anthropic", "openai", "google"]

const PLAN_FEATURES = [
  "Workspace starts at $5/month",
  "Unlimited PDF uploads",
  "Custom entity type definitions",
  "Multi-model NER extraction",
  "Annotation export (JSON, CSV)",
  "Role-based project organization",
  "Usage dashboard with cost breakdown",
  "Stripe-managed billing",
]

// Price comes back from Drizzle `numeric(10,4)` as a string like "15.0000".
// Format to 2 decimals for display. Keep the raw string as source of truth.
function formatUsd(raw: string): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return `$${raw}`
  return `$${n.toFixed(2)}`
}

// public.models has no display-name column. Humanize the id for now; if we
// want branded labels later, add a `display_name` column and migrate.
function humanizeModelId(id: string): string {
  return id
    .split("-")
    .map((part) => {
      if (/^\d/.test(part)) return part // leave version tokens like "4o", "2.0"
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(" ")
}

function isAvailable(model: FoundModel, now: Date): boolean {
  if (!model.endAvailableDate) return true
  return new Date(model.endAvailableDate).getTime() > now.getTime()
}

type ProviderGroup = ProviderDisplay & { models: FoundModel[] }

function groupByProvider(models: FoundModel[]): ProviderGroup[] {
  const now = new Date()
  const buckets = new Map<ProviderSlug, FoundModel[]>()
  for (const m of models) {
    if (!isAvailable(m, now)) continue
    if (!(m.provider in PROVIDER_DISPLAY)) continue
    const slug = m.provider as ProviderSlug
    const list = buckets.get(slug) ?? []
    list.push(m)
    buckets.set(slug, list)
  }
  return PROVIDER_ORDER.filter((slug) => buckets.has(slug)).map((slug) => ({
    ...PROVIDER_DISPLAY[slug],
    models: (buckets.get(slug) ?? []).slice().sort((a, b) => a.id.localeCompare(b.id)),
  }))
}

export const Route = createFileRoute("/_public/pricing")({
  loader: async () => {
    try {
      const models = (await getAllModels()) as FoundModel[]
      return { providerGroups: groupByProvider(models), loadError: null as string | null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { providerGroups: [] as ProviderGroup[], loadError: message }
    }
  },
  component: PricingPage,
})

function PricingPage() {
  const { providerGroups, loadError } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-24 text-center bg-[#F4F4F4]">
        <h1 className="text-[40px] font-medium leading-[1.2] text-[#171A20] tracking-normal mb-6 max-w-2xl">
          Simple, usage-based pricing
        </h1>
        <p className="text-[16px] font-normal leading-[1.6] text-[#393C41] max-w-xl mb-10">
          Every workspace starts at $5/month, then usage is billed from the exact LLM tokens you
          consume. Developers manage projects and analysts focus on labeling and review.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            to="/signup"
            className="flex items-center justify-center min-h-10 w-full sm:w-50 rounded-[4px] bg-[#3E6AE1] px-4 text-[14px] font-medium text-white border-[3px] border-transparent transition-all duration-[330ms] hover:bg-[#2e52b5] focus:border-[#3E6AE1] focus:shadow-[inset_0_0_0_2px_white]"
          >
            Get started free
          </Link>
          <Link
            to="/signup"
            className="flex items-center justify-center min-h-10 w-full sm:w-50 rounded-[4px] bg-white px-4 text-[14px] font-medium text-[#393C41] border-[3px] border-transparent transition-all duration-[330ms] hover:bg-[#F4F4F4]"
          >
            Try the demo
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-white">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-[32px] font-medium text-[#171A20] mb-4 text-center">
            How billing works
          </h2>
          <p className="text-[16px] text-[#5C5E62] text-center mb-16 max-w-lg mx-auto">
            Every LLM extraction call is metered by token count and reported to Stripe at the end of
            each billing period.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Upload & annotate",
                body: "Upload your PDFs and define the entity types you want to extract. Label a handful of examples to guide the model.",
              },
              {
                step: "02",
                title: "Extract with LLMs",
                body: "Dokumen sends your documents to your chosen model. Input and output tokens are recorded at the exact rate in our billing table.",
              },
              {
                step: "03",
                title: "Pay for what you use",
                body: "At the end of the month Stripe bills a $5 workspace base fee plus the token usage accumulated by your extraction runs.",
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex flex-col gap-3">
                <span className="text-[14px] font-medium text-[#3E6AE1] font-mono">{step}</span>
                <h3 className="text-[17px] font-medium text-[#171A20]">{title}</h3>
                <p className="text-[14px] font-normal text-[#5C5E62] leading-[1.6]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subscription plan */}
      <section className="py-24 px-6 bg-[#F4F4F4]">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-[32px] font-medium text-[#171A20] mb-4 text-center">
            Base plan + metered usage
          </h2>
          <p className="text-[16px] text-[#5C5E62] text-center mb-16 max-w-lg mx-auto">
            Each workspace has a $5 monthly base subscription, and model usage is charged on top at
            the live rates below.
          </p>

          <div className="mx-auto max-w-md border border-[#EEEEEE] bg-white p-8">
            <div className="mb-6">
              <p className="text-[14px] font-medium text-[#3E6AE1] mb-2">Workspace plan</p>
              <p className="text-[40px] font-medium text-[#171A20] leading-none">
                $5
                <span className="text-[16px] font-normal text-[#5C5E62] ml-1">/ month base</span>
              </p>
              <p className="text-[14px] text-[#5C5E62] mt-2">
                + LLM usage metered from our live pricing table
              </p>
            </div>

            <ul className="space-y-3 mb-8">
              {PLAN_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckIcon className="h-4 w-4 text-[#3E6AE1] mt-0.5 shrink-0" />
                  <span className="text-[14px] text-[#393C41]">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              <div className="border border-[#EEEEEE] p-4">
                <p className="text-[13px] font-medium text-[#171A20]">Developer</p>
                <p className="mt-2 text-[13px] leading-[1.6] text-[#5C5E62]">
                  Full project permissions: create projects, upload PDFs, manage entity types, and
                  run extraction workflows.
                </p>
              </div>
              <div className="border border-[#EEEEEE] p-4">
                <p className="text-[13px] font-medium text-[#171A20]">Analyst</p>
                <p className="mt-2 text-[13px] leading-[1.6] text-[#5C5E62]">
                  Limited to labeling and reviewing pre-uploaded PDFs. Analysts can work inside the
                  project without changing project setup.
                </p>
              </div>
            </div>

            <Link
              to="/signup"
              className="flex items-center justify-center min-h-10 w-full rounded-[4px] bg-[#3E6AE1] px-4 text-[14px] font-medium text-white border-[3px] border-transparent transition-all duration-[330ms] hover:bg-[#2e52b5]"
            >
              Create your account
            </Link>
            <p className="text-[12px] text-[#8E8E8E] text-center mt-3">
              Add a payment method after sign-up to activate extraction
            </p>
          </div>
        </div>
      </section>

      {/* Model pricing table */}
      <section className="py-24 px-6 bg-white">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-[32px] font-medium text-[#171A20] mb-4 text-center">Model pricing</h2>
          <p className="text-[16px] text-[#5C5E62] text-center mb-16 max-w-lg mx-auto">
            The rates below are the exact values our workers use to compute your Stripe charges.
            Prices are per 1 million tokens.
          </p>

          {loadError || providerGroups.length === 0 ? (
            <div className="mx-auto max-w-md border border-[#EEEEEE] bg-[#F4F4F4] p-6 text-center">
              <p className="text-[14px] text-[#393C41]">
                Live pricing is temporarily unavailable. Contact{" "}
                <a href="mailto:sales@dokumen.ai" className="text-[#3E6AE1] underline">
                  sales@dokumen.ai
                </a>{" "}
                for current rates.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {providerGroups.map((provider) => (
                <div key={provider.slug}>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[12px] font-medium ${provider.color} ${provider.bg} ${provider.border}`}
                    >
                      {provider.name}
                    </span>
                  </div>

                  <div className="border border-[#EEEEEE] overflow-hidden">
                    <table className="w-full text-[14px]">
                      <thead>
                        <tr className="border-b border-[#EEEEEE] bg-[#F4F4F4]">
                          <th className="px-4 py-3 text-left font-medium text-[#171A20]">Model</th>
                          <th className="px-4 py-3 text-right font-medium text-[#171A20]">
                            Input / 1M tokens
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-[#171A20]">
                            Output / 1M tokens
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {provider.models.map((model, i) => (
                          <tr
                            key={model.id}
                            className={
                              i < provider.models.length - 1 ? "border-b border-[#EEEEEE]" : ""
                            }
                          >
                            <td className="px-4 py-3 font-mono text-[13px] text-[#393C41]">
                              {humanizeModelId(model.id)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-[#393C41]">
                              {formatUsd(model.usdPer1mInput)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-[#393C41]">
                              {formatUsd(model.usdPer1mOutput)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[12px] text-[#8E8E8E] mt-6 text-center">
            Rates are read live from our billing table and match what workers charge per request.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-[#F4F4F4]">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-[32px] font-medium text-[#171A20] mb-16 text-center">
            Common questions
          </h2>

          <div className="flex flex-col divide-y divide-[#EEEEEE]">
            {[
              {
                q: "When am I charged?",
                a: "Stripe charges the $5 workspace base subscription monthly and tallies metered model usage on the same billing cycle. You can monitor usage in the billing dashboard.",
              },
              {
                q: "What if I don't add a payment method?",
                a: "You can still explore the product, but usage-based extraction and the paid workspace plan are gated behind an active Stripe subscription with a saved payment method.",
              },
              {
                q: "Can I choose which model to use?",
                a: "Yes. Each extraction request lets you pick among the models listed above. Cheaper models are great for high-volume pipelines; larger models excel on complex documents.",
              },
              {
                q: "Is there a free trial?",
                a: "Creating an account is free. Billing starts when you activate the $5/month workspace subscription and begin running usage-based extraction.",
              },
              {
                q: "How do I cancel?",
                a: "You can cancel your subscription at any time from the billing page. Your account and all projects remain accessible; LLM extraction is paused until you resubscribe.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="py-6">
                <p className="text-[14px] font-medium text-[#171A20] mb-2">{q}</p>
                <p className="text-[14px] font-normal text-[#5C5E62] leading-[1.6]">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-32 px-6 flex flex-col items-center justify-center text-center bg-white min-h-[40vh]">
        <h2 className="text-[40px] font-medium text-[#171A20] mb-6">Start extracting today</h2>
        <p className="text-[16px] font-normal text-[#393C41] mb-10 max-w-md">
          Create an account, upload your first PDF, and add a payment method in under five minutes.
        </p>
        <Link
          to="/signup"
          className="rounded-[4px] bg-[#3E6AE1] px-16 py-3 flex items-center justify-center text-[14px] font-medium text-white transition-all duration-[330ms] hover:bg-[#2e52b5]"
        >
          Create your account
        </Link>
      </section>
    </div>
  )
}
