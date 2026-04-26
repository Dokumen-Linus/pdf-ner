import { createFileRoute, Link } from "@tanstack/react-router"
import { CheckIcon } from "lucide-react"

import { getAllModels } from "@/db-fns/public/models"
import { m } from "@/integrations/paraglide/messages.js"

import type { FoundModel } from "@/db/types"

type ProviderSlug = "anthropic" | "openai" | "gemini"

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
  gemini: {
    slug: "gemini",
    name: "Gemini",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
}

// The three values above mirror the CHECK constraint on public.models.provider
// (db/migrations/00005_create_models.sql). Unknown providers are filtered out.
const PROVIDER_ORDER: ProviderSlug[] = ["anthropic", "openai", "gemini"]

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
  const [pricingUnavailableBefore, pricingUnavailableAfter = ""] = m.pricing_live_unavailable({
    email: "__EMAIL__",
  }).split("__EMAIL__")
  const planFeatures = [
    m.pricing_feature_1(),
    m.pricing_feature_2(),
    m.pricing_feature_3(),
    m.pricing_feature_4(),
    m.pricing_feature_5(),
    m.pricing_feature_6(),
    m.pricing_feature_7(),
    m.pricing_feature_8(),
  ]
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
      title: m.pricing_step_3_title(),
      body: m.pricing_step_3_body(),
    },
  ]
  const faqItems = [
    { q: m.pricing_faq_q1(), a: m.pricing_faq_a1() },
    { q: m.pricing_faq_q2(), a: m.pricing_faq_a2() },
    { q: m.pricing_faq_q3(), a: m.pricing_faq_a3() },
    { q: m.pricing_faq_q4(), a: m.pricing_faq_a4() },
    { q: m.pricing_faq_q5(), a: m.pricing_faq_a5() },
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

      {/* Subscription plan */}
      <section className="bg-[#F4F4F4] px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-[32px] font-medium text-[#171A20]">
            {m.pricing_plan_title()}
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-[16px] text-[#5C5E62]">
            {m.pricing_plan_description()}
          </p>

          <div className="mx-auto max-w-md border border-[#EEEEEE] bg-white p-8">
            <div className="mb-6">
              <p className="mb-2 text-[14px] font-medium text-[#3E6AE1]">
                {m.pricing_plan_label()}
              </p>
              <p className="text-[40px] leading-none font-medium text-[#171A20]">
                $5
                <span className="ml-1 text-[16px] font-normal text-[#5C5E62]">
                  {m.pricing_plan_price_suffix()}
                </span>
              </p>
              <p className="mt-2 text-[14px] text-[#5C5E62]">
                {m.pricing_plan_metered_note()}
              </p>
            </div>

            <ul className="mb-8 space-y-3">
              {planFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#3E6AE1]" />
                  <span className="text-[14px] text-[#393C41]">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              <div className="border border-[#EEEEEE] p-4">
                <p className="text-[13px] font-medium text-[#171A20]">
                  {m.pricing_role_developer_title()}
                </p>
                <p className="mt-2 text-[13px] leading-[1.6] text-[#5C5E62]">
                  {m.pricing_role_developer_body()}
                </p>
              </div>
              <div className="border border-[#EEEEEE] p-4">
                <p className="text-[13px] font-medium text-[#171A20]">
                  {m.pricing_role_analyst_title()}
                </p>
                <p className="mt-2 text-[13px] leading-[1.6] text-[#5C5E62]">
                  {m.pricing_role_analyst_body()}
                </p>
              </div>
            </div>

            <Link
              to="/signup"
              className="flex min-h-10 w-full items-center justify-center rounded-[4px] border-[3px] border-transparent bg-[#3E6AE1] px-4 text-[14px] font-medium text-white transition-all duration-[330ms] hover:bg-[#2e52b5]"
            >
              {m.pricing_create_account_cta()}
            </Link>
            <p className="mt-3 text-center text-[12px] text-[#8E8E8E]">
              {m.pricing_payment_note()}
            </p>
          </div>
        </div>
      </section>

      {/* Model pricing table */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-[32px] font-medium text-[#171A20]">
            {m.pricing_models_title()}
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-[16px] text-[#5C5E62]">
            {m.pricing_models_description()}
          </p>

          {loadError || providerGroups.length === 0 ? (
            <div className="mx-auto max-w-md border border-[#EEEEEE] bg-[#F4F4F4] p-6 text-center">
              <p className="text-[14px] text-[#393C41]">
                {pricingUnavailableBefore}
                <a href="mailto:sales@dokumen.ai" className="text-[#3E6AE1] underline">
                  sales@dokumen.ai
                </a>{" "}
                {pricingUnavailableAfter}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {providerGroups.map((provider) => (
                <div key={provider.slug}>
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[12px] font-medium ${provider.color} ${provider.bg} ${provider.border}`}
                    >
                      {provider.name}
                    </span>
                  </div>

                  <div className="overflow-hidden border border-[#EEEEEE]">
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
                            <td className="px-4 py-3 text-right text-[#393C41] tabular-nums">
                              {formatUsd(model.usdPer1mInput)}
                            </td>
                            <td className="px-4 py-3 text-right text-[#393C41] tabular-nums">
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

          <p className="mt-6 text-center text-[12px] text-[#8E8E8E]">
            {m.pricing_models_note()}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#F4F4F4] px-6 py-24">
        <div className="mx-auto max-w-2xl">
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
        <h2 className="mb-6 text-[40px] font-medium text-[#171A20]">
          {m.pricing_bottom_title()}
        </h2>
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
