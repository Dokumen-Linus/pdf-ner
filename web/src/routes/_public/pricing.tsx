import { createFileRoute, Link } from "@tanstack/react-router"

import { CheckIcon } from "@/components/icons"
import { getAllChatModels, getAllExtractMethods } from "@/db-fns/public/models"
import { m } from "@/integrations/paraglide/messages.js"

import type { ChatModel, ExtractMethod } from "@/db/types"

type ProviderDisplay = {
  host: string
  name: string
  color: string
  bg: string
  border: string
}

const PROVIDER_DISPLAY: Record<string, Omit<ProviderDisplay, "host">> = {
  Anthropic: {
    name: "Anthropic",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  OpenAI: {
    name: "OpenAI",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  Google: {
    name: "Gemini",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
}

// Price comes back from Drizzle `numeric(8,4)` as a string like "15.0000".
// Format to 2 decimals for display. Keep the raw string as source of truth.
function formatUsd(raw: string): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return `$${raw}`
  return `$${n.toFixed(2)}`
}

function formatUsdSec(raw: string | null): string {
  if (!raw) return "—"
  const n = Number(raw)
  if (!Number.isFinite(n)) return `$${raw}`
  return `$${n.toFixed(6)}`
}

function formatUsdPages(raw: string | null): string {
  if (!raw) return "—"
  const n = Number(raw)
  if (!Number.isFinite(n)) return `$${raw}`
  return `$${n.toFixed(2)}`
}

function formatDate(raw: Date | string | null): string {
  if (!raw) return "—"
  const date = new Date(raw)
  if (isNaN(date.getTime())) return String(raw)
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function isAvailable(model: ChatModel, now: Date): boolean {
  if (!model.endAvailableDate) return true
  return new Date(model.endAvailableDate).getTime() > now.getTime()
}

type ProviderGroup = ProviderDisplay & { models: ChatModel[] }

function groupByProvider(models: ChatModel[]): ProviderGroup[] {
  const now = new Date()
  const buckets = new Map<string, ChatModel[]>()
  for (const model of models) {
    if (!isAvailable(model, now)) continue
    const host = model.host
    const list = buckets.get(host) ?? []
    list.push(model)
    buckets.set(host, list)
  }

  const hostOrder = ["Anthropic", "OpenAI", "Google"]
  const hosts = Array.from(buckets.keys()).sort((a, b) => {
    const idxA = hostOrder.indexOf(a)
    const idxB = hostOrder.indexOf(b)
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return a.localeCompare(b)
  })

  return hosts.map((host) => {
    const display = PROVIDER_DISPLAY[host] || {
      name: host,
      color: "text-gray-700",
      bg: "bg-gray-50",
      border: "border-gray-200",
    }
    return {
      host,
      ...display,
      models: (buckets.get(host) ?? []).slice().sort((a, b) => a.id.localeCompare(b.id)),
    }
  })
}

export const Route = createFileRoute("/_public/pricing")({
  loader: async () => {
    try {
      const [models, extractMethods] = await Promise.all([
        getAllChatModels(),
        getAllExtractMethods(),
      ])
      return {
        providerGroups: groupByProvider(models as ChatModel[]),
        extractMethods: extractMethods as ExtractMethod[],
        loadError: null as string | null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        providerGroups: [] as ProviderGroup[],
        extractMethods: [] as ExtractMethod[],
        loadError: message,
      }
    }
  },
  component: PricingPage,
})

function PricingPage() {
  const { providerGroups, extractMethods, loadError } = Route.useLoaderData()
  const [pricingUnavailableBefore, pricingUnavailableAfter = ""] = m
    .pricing_live_unavailable({
      email: "__EMAIL__",
    })
    .split("__EMAIL__")
  const pricingSteps = [
    {
      step: "01",
      title: m.pricing_step_1_title(),
      body: m.pricing_step_1_body(),
    },
    {
      step: "02",
      title: m.pricing_step_2_title(),
      body: m.pricing_step_2_body(),
    },
    {
      step: "03",
      title: "Pay dynamically per month",
      body: "On your monthly billing charge date (exactly one month after sign-up), our database-recorded usage system creates a Stripe PaymentIntent for your base fee plus metered token usage.",
    },
  ]
  const faqItems = [
    { q: m.pricing_faq_q1(), a: m.pricing_faq_a1() },
    {
      q: "How are individual and organization accounts structured?",
      a: "An individual account supports a single user with the individual role. Organization accounts support one or more users with roles of admin, developer, or analyst (each org must have at least one admin). The base fee is $10/month for individual accounts, and $10 per user/month for organization accounts, in addition to metered model/extraction token usage.",
    },
    {
      q: "Can I upgrade my account later?",
      a: "Yes. An individual user can upgrade to an organization account instantly via their profile page. When you upgrade, your owned projects are transferred to a new Default team, your role changes to admin, and your next payment date and saved card details are copied over without modification.",
    },
    {
      q: "Why do you require card verification immediately on sign-up?",
      a: "We require adding a valid credit or debit card during sign-up to verify account validity via Stripe SetupIntents. However, you will not be charged anything at creation. Your first billing invoice is processed exactly one month after registration.",
    },
    {
      q: "How are payments processed?",
      a: "Payments are processed securely via direct integration with Stripe (SetupIntent, Customer, PaymentIntent, refund, disputes, etc.). This customized design allows us to bypass the standard 0.9% Stripe Billing surcharge completely, passing those savings directly to you in the form of lower metered rates.",
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="flex min-h-[50vh] flex-col items-center justify-center bg-[#F4F4F4] px-6 py-24 text-center">
        <h1 className="mb-6 max-w-2xl text-[40px] leading-[1.2] font-medium tracking-normal text-[#171A20]">
          {m.pricing_hero_title()}
        </h1>
        <p className="mb-10 max-w-xl text-[16px] leading-[1.6] font-normal text-[#393C41]">
          {m.pricing_hero_description()}
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Link
            to="/signup"
            className="flex min-h-10 w-full items-center justify-center rounded-[4px] border-[3px] border-transparent bg-[#3E6AE1] px-4 text-[14px] font-medium text-white transition-all duration-[330ms] hover:bg-[#2e52b5] focus:border-[#3E6AE1] focus:shadow-[inset_0_0_0_2px_white] sm:w-50"
          >
            {m.pricing_hero_cta_primary()}
          </Link>
          <Link
            to="/signup"
            className="flex min-h-10 w-full items-center justify-center rounded-[4px] border-[3px] border-transparent bg-white px-4 text-[14px] font-medium text-[#393C41] transition-all duration-[330ms] hover:bg-[#F4F4F4] sm:w-50"
          >
            {m.pricing_hero_cta_secondary()}
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-[32px] font-medium text-[#171A20]">
            {m.pricing_how_title()}
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-[16px] text-[#5C5E62]">
            {m.pricing_how_description()}
          </p>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {pricingSteps.map(({ step, title, body }) => (
              <div key={step} className="flex flex-col gap-3">
                <span className="font-mono text-[14px] font-medium text-[#3E6AE1]">{step}</span>
                <h3 className="text-[17px] font-medium text-[#171A20]">{title}</h3>
                <p className="text-[14px] leading-[1.6] font-normal text-[#5C5E62]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subscription plans */}
      <section className="bg-[#F4F4F4] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-[32px] font-medium text-[#171A20]">
            Flexible Plans
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-[16px] text-[#5C5E62]">
            Choose the plan type that matches your work. All accounts are billed monthly with
            verified payment setup required immediately.
          </p>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Individual Plan */}
            <div className="flex flex-col border border-[#EEEEEE] bg-white p-8">
              <div className="mb-6">
                <p className="mb-2 text-[14px] font-medium tracking-wider text-[#3E6AE1] uppercase">
                  Individual Workspace
                </p>
                <p className="text-[40px] leading-none font-medium text-[#171A20]">
                  $10
                  <span className="ml-1 text-[16px] font-normal text-[#5C5E62]">/ month base</span>
                </p>
                <p className="mt-2 text-[14px] text-[#5C5E62]">{m.pricing_plan_metered_note()}</p>
              </div>

              <ul className="mb-8 flex-1 space-y-3 border-t border-[#EEEEEE] pt-6">
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">
                    Single active user (role: <strong>individual</strong>)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">{m.pricing_feature_2()}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">{m.pricing_feature_3()}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">{m.pricing_feature_4()}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">{m.pricing_feature_5()}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">
                    Stripe card verification required immediately at signup
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">
                    Zero-dollar initial charge (first billing cycle is after 1 month)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">
                    Instant one-click upgrade to Organization on profile page
                  </span>
                </li>
              </ul>

              <Link
                to="/signup"
                className="mt-6 flex min-h-10 w-full items-center justify-center rounded-[4px] border-[3px] border-transparent bg-[#3E6AE1] px-4 text-[14px] font-medium text-white transition-all duration-[330ms] hover:bg-[#2e52b5]"
              >
                Start Individual
              </Link>
            </div>

            {/* Organization Plan */}
            <div className="relative flex flex-col border border-[#3E6AE1] bg-white p-8 shadow-lg">
              <span className="absolute -top-3 right-6 bg-[#3E6AE1] px-3 py-0.5 text-[11px] font-medium tracking-wider text-white uppercase">
                Team Scale
              </span>
              <div className="mb-6">
                <p className="mb-2 text-[14px] font-medium tracking-wider text-[#3E6AE1] uppercase">
                  Organization Account
                </p>
                <p className="text-[40px] leading-none font-medium text-[#171A20]">
                  $10
                  <span className="ml-1 text-[16px] font-normal text-[#5C5E62]">
                    / user / month base
                  </span>
                </p>
                <p className="mt-2 text-[14px] text-[#5C5E62]">{m.pricing_plan_metered_note()}</p>
              </div>

              <ul className="mb-8 flex-1 space-y-3 border-t border-[#EEEEEE] pt-6">
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">
                    Multiple users with roles: <strong>admin</strong>, <strong>developer</strong>,{" "}
                    <strong>analyst</strong>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">
                    Requires at least one <strong>admin</strong> user in the workspace
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">
                    Admin can invite new members to default/custom teams
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">
                    Billing scales automatically with the number of users (<code>n_users</code>)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">
                    Transferred owned projects are safe in Default team on upgrade
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">
                    Bypass Stripe Billing fee overhead via direct secure integration
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">
                    Dedicated organization usage & cost breakdown dashboard
                  </span>
                </li>
              </ul>

              <Link
                to="/signup"
                className="mt-6 flex min-h-10 w-full items-center justify-center rounded-[4px] border-[3px] border-transparent bg-[#171A20] px-4 text-[14px] font-medium text-white transition-all duration-[330ms] hover:bg-[#333333]"
              >
                Start Organization
              </Link>
            </div>
          </div>
          <p className="mt-6 text-center text-[12px] text-[#8E8E8E]">
            Stripe setup intent verification is required immediately on signup. No upfront charge is
            made.
          </p>
        </div>
      </section>

      {/* Role Definitions */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-[32px] font-medium text-[#171A20]">
            Granular Workspace Roles
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-[16px] text-[#5C5E62]">
            All user roles are explicitly tracked in the database to guarantee security and
            compliance.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col border border-[#EEEEEE] bg-white p-5">
              <span className="mb-2 font-mono text-[11px] font-semibold tracking-wider text-[#3E6AE1] uppercase">
                Individual Account
              </span>
              <h3 className="mb-2 text-[16px] font-medium text-[#171A20]">Individual User</h3>
              <p className="flex-1 text-[13px] leading-[1.6] text-[#5C5E62]">
                A single user with full admin capabilities for their standalone workspace. Can
                create projects, upload documents, run extractions, and manage billing.
              </p>
            </div>

            <div className="flex flex-col border border-[#EEEEEE] bg-white p-5">
              <span className="mb-2 font-mono text-[11px] font-semibold tracking-wider text-[#3E6AE1] uppercase">
                Organization Only
              </span>
              <h3 className="mb-2 text-[16px] font-medium text-[#171A20]">Workspace Admin</h3>
              <p className="flex-1 text-[13px] leading-[1.6] text-[#5C5E62]">
                Manages organization members, invites users, sets team groupings (e.g.
                &quot;Default&quot; team), and manages the secure shared billing methods and payment
                options.
              </p>
            </div>

            <div className="flex flex-col border border-[#EEEEEE] bg-white p-5">
              <span className="mb-2 font-mono text-[11px] font-semibold tracking-wider text-[#3E6AE1] uppercase">
                Organization Only
              </span>
              <h3 className="mb-2 text-[16px] font-medium text-[#171A20]">Developer</h3>
              <p className="flex-1 text-[13px] leading-[1.6] text-[#5C5E62]">
                Full technical workspace permissions. Developers create projects, upload PDFs,
                configure custom entity definitions, and invoke extraction workflows.
              </p>
            </div>

            <div className="flex flex-col border border-[#EEEEEE] bg-white p-5">
              <span className="mb-2 font-mono text-[11px] font-semibold tracking-wider text-[#3E6AE1] uppercase">
                Organization Only
              </span>
              <h3 className="mb-2 text-[16px] font-medium text-[#171A20]">Analyst</h3>
              <p className="flex-1 text-[13px] leading-[1.6] text-[#5C5E62]">
                Focuses entirely on labeling and reviewing PDF datasets. Analysts have read-only
                project permissions, helping keep human-in-the-loop validation active.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Model pricing table */}
      <section className="bg-[#F4F4F4] px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-[32px] font-medium text-[#171A20]">
            {m.pricing_models_title()}
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-[16px] text-[#5C5E62]">
            {m.pricing_models_description()}
          </p>

          {loadError || providerGroups.length === 0 ? (
            <div className="mx-auto max-w-md border border-[#EEEEEE] bg-white p-6 text-center">
              <p className="text-[14px] text-[#393C41]">
                {pricingUnavailableBefore}
                <a href="mailto:sales@dokumen.ai" className="text-[#3E6AE1] underline">
                  {m.pricing_sales_email()}
                </a>{" "}
                {pricingUnavailableAfter}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {providerGroups.map((provider: ProviderGroup) => (
                <div key={provider.host}>
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[12px] font-medium ${provider.color} ${provider.bg} ${provider.border}`}
                    >
                      {provider.name}
                    </span>
                  </div>

                  <div className="overflow-hidden border border-[#EEEEEE] bg-white">
                    <table className="w-full text-[14px]">
                      <thead>
                        <tr className="border-b border-[#EEEEEE] bg-[#F4F4F4]">
                          <th className="px-4 py-3 text-left font-medium text-[#171A20]">
                            {m.pricing_table_model()}
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-[#171A20]">
                            {m.pricing_table_input()}
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-[#171A20]">
                            {m.pricing_table_output()}
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-[#171A20]">
                            Release Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {provider.models.map((model: ChatModel, i: number) => (
                          <tr
                            key={model.id}
                            className={
                              i < provider.models.length - 1 ? "border-b border-[#EEEEEE]" : ""
                            }
                          >
                            <td className="px-4 py-3 font-mono text-[13px] font-medium text-[#171A20]">
                              {model.displayName}
                            </td>
                            <td className="px-4 py-3 text-right text-[#393C41] tabular-nums">
                              {formatUsd(model.usdPer1mInput)}
                            </td>
                            <td className="px-4 py-3 text-right text-[#393C41] tabular-nums">
                              {formatUsd(model.usdPer1mOutput)}
                            </td>
                            <td className="px-4 py-3 text-right text-[#393C41] tabular-nums">
                              {formatDate(model.releaseDate)}
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

          <p className="mt-6 text-center text-[12px] text-[#8E8E8E]">{m.pricing_models_note()}</p>
        </div>
      </section>

      {/* Extraction Methods pricing table */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-[32px] font-medium text-[#171A20]">
            Extraction & OCR Method Pricing
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-[16px] text-[#5C5E62]">
            Rates for text extraction and OCR methods. Prices are metered per page or per second of
            processing time.
          </p>

          {loadError || !extractMethods || extractMethods.length === 0 ? (
            <div className="mx-auto max-w-md border border-[#EEEEEE] bg-[#F4F4F4] p-6 text-center">
              <p className="text-[14px] text-[#393C41]">
                Extraction rates are temporarily unavailable.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden border border-[#EEEEEE] bg-white">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-[#EEEEEE] bg-[#F4F4F4]">
                    <th className="px-4 py-3 text-left font-medium text-[#171A20]">Method</th>
                    <th className="px-4 py-3 text-left font-medium text-[#171A20]">Type</th>
                    <th className="px-4 py-3 text-right font-medium text-[#171A20]">
                      Per 1M Pages
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-[#171A20]">Per Second</th>
                    <th className="px-4 py-3 text-right font-medium text-[#171A20]">
                      Release Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {extractMethods.map((method: ExtractMethod, i: number) => (
                    <tr
                      key={method.id}
                      className={i < extractMethods.length - 1 ? "border-b border-[#EEEEEE]" : ""}
                    >
                      <td className="px-4 py-3 font-mono text-[13px] font-medium text-[#171A20]">
                        {method.displayName}
                      </td>
                      <td className="px-4 py-3 font-mono text-[13px] text-[#393C41]">
                        {method.methodType}
                      </td>
                      <td className="px-4 py-3 text-right text-[#393C41] tabular-nums">
                        {formatUsdPages(method.usdPer1mPages)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#393C41] tabular-nums">
                        {formatUsdSec(method.usdPerSec)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#393C41] tabular-nums">
                        {formatDate(method.releaseDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#F4F4F4] px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-16 text-center text-[32px] font-medium text-[#171A20]">
            {m.pricing_faq_title()}
          </h2>

          <div className="flex flex-col divide-y divide-[#EEEEEE]">
            {faqItems.map(({ q, a }) => (
              <div key={q} className="py-6">
                <p className="mb-2 text-[14px] font-medium text-[#171A20]">{q}</p>
                <p className="text-[14px] leading-[1.6] font-normal text-[#5C5E62]">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="flex min-h-[40vh] flex-col items-center justify-center bg-white px-6 py-32 text-center">
        <h2 className="mb-6 text-[40px] font-medium text-[#171A20]">{m.pricing_bottom_title()}</h2>
        <p className="mb-10 max-w-md text-[16px] font-normal text-[#393C41]">
          {m.pricing_bottom_description()}
        </p>
        <Link
          to="/signup"
          className="flex items-center justify-center rounded-[4px] bg-[#3E6AE1] px-16 py-3 text-[14px] font-medium text-white transition-all duration-[330ms] hover:bg-[#2e52b5]"
        >
          {m.pricing_bottom_cta()}
        </Link>
      </section>
    </div>
  )
}
