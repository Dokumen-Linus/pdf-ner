import { createFileRoute, Link } from "@tanstack/react-router"

import { m } from "@/integrations/paraglide/messages.js"

export const Route = createFileRoute("/_public/platform")({
  component: PlatformPage,
})

type Provider = {
  name: string
  detail: string
  icon: string
}

type DiagramNode = {
  title: string
  body: string
}

const requiredProviders: Provider[] = [
  {
    name: "AWS",
    detail: "Infrastructure, application storage, SES, secrets, and deployment resources.",
    icon: "/icons/aws-color.svg",
  },
  {
    name: "Cloudflare",
    detail: "DNS, edge protection, and WAF in front of the public application.",
    icon: "/icons/cloudflare-color.svg",
  },
  {
    name: "Runpod",
    detail: "GPU capacity for OCR and model-serving workloads.",
    icon: "/icons/runpod.svg",
  },
  {
    name: "Stripe",
    detail: "Payments, billing setup, and customer payment methods.",
    icon: "/icons/stripe.svg",
  },
]

const optionalProviders: Provider[] = [
  {
    name: "OpenAI",
    detail: "Optional LLM provider for extraction and prompt workflows.",
    icon: "/icons/openai.svg",
  },
  {
    name: "Anthropic",
    detail: "Optional LLM provider for model choice and extraction workflows.",
    icon: "/icons/anthropic.svg",
  },
  {
    name: "Google",
    detail: "Optional model and source integrations, including Drive and Gmail.",
    icon: "/icons/google.svg",
  },
  {
    name: "Microsoft",
    detail: "Optional source integrations, including OneDrive and Outlook Email.",
    icon: "/icons/microsoft.svg",
  },
]

const documentSources: Provider[] = [
  {
    name: "Google Drive",
    detail: "google_drive",
    icon: "/icons/google-drive.svg",
  },
  {
    name: "OneDrive",
    detail: "onedrive",
    icon: "/icons/onedrive.svg",
  },
  {
    name: "Outlook Email",
    detail: "outlook_email",
    icon: "/icons/outlook.svg",
  },
  {
    name: "Gmail",
    detail: "gmail",
    icon: "/icons/gmail.svg",
  },
  {
    name: "AWS S3",
    detail: "aws_s3",
    icon: "/icons/aws-color.svg",
  },
  {
    name: "Azure Blob Storage",
    detail: "azure_blob",
    icon: "/icons/azure-blob.svg",
  },
  {
    name: "Google Cloud Storage",
    detail: "gcs",
    icon: "/icons/google-cloud.svg",
  },
]

const diagramGroups: Array<{ label: string; nodes: DiagramNode[] }> = [
  {
    label: "Experience",
    nodes: [
      {
        title: "Public web app",
        body: "Routes, authenticated projects, labeling UI, billing, and demos.",
      },
      {
        title: "FastAPI",
        body: "Upload, avatar, PDF utility, OCR, and extraction API boundaries.",
      },
    ],
  },
  {
    label: "Processing",
    nodes: [
      {
        title: "Workers",
        body: "Celery orchestration for watching sources, extracting text, and running entities.",
      },
      {
        title: "GPU services",
        body: "Runpod-hosted OCR and model workers for document-heavy workloads.",
      },
    ],
  },
  {
    label: "State",
    nodes: [
      {
        title: "PostgreSQL",
        body: "Projects, billing records, prompts, PDFs, annotations, and source sync state.",
      },
      {
        title: "Object storage",
        body: "PDFs, avatars, and generated document artifacts.",
      },
    ],
  },
  {
    label: "Edges",
    nodes: [
      {
        title: "Document sources",
        body: "Drive, OneDrive, email, S3, Azure Blob, and Google Cloud Storage.",
      },
      {
        title: "LLM providers",
        body: "OpenAI, Anthropic, Google, or Microsoft when enabled by the project.",
      },
    ],
  },
]

function PlatformPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-[#F4F4F4] px-6 py-24">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-[1.1fr_0.9fr] md:items-end">
          <div>
            <h1 className="mb-6 text-[40px] leading-[1.15] font-medium text-[#171A20]">
              {m.platform_title()}
            </h1>
            <p className="max-w-2xl text-[16px] leading-[1.75] text-[#5C5E62]">
              {m.platform_description()}
            </p>
          </div>

          <div className="border border-[#E6E6E6] bg-white p-6 shadow-[0_18px_44px_rgba(23,26,32,0.06)]">
            <p className="mb-4 text-[13px] font-semibold tracking-[0.18em] text-[#3E6AE1] uppercase">
              {m.platform_hero_panel_label()}
            </p>
            <div className="grid gap-3">
              {[
                m.platform_hero_panel_item_documents(),
                m.platform_hero_panel_item_models(),
                m.platform_hero_panel_item_storage(),
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between border border-[#EEEEEE] bg-[#FAFAFA] px-4 py-3"
                >
                  <span className="text-[14px] font-medium text-[#171A20]">{item}</span>
                  <span className="h-2 w-2 rounded-full bg-[#3E6AE1]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-2xl">
            <h2 className="mb-4 text-[32px] font-medium text-[#171A20]">
              {m.platform_architecture_title()}
            </h2>
            <p className="text-[16px] leading-[1.75] text-[#5C5E62]">
              {m.platform_architecture_description()}
            </p>
          </div>

          <div className="overflow-hidden border border-[#E6E6E6] bg-[#FAFAFA] p-5 md:p-8">
            <div className="grid gap-5 lg:grid-cols-4">
              {diagramGroups.map((group, groupIndex) => (
                <div key={group.label} className="relative">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3E6AE1] text-[12px] font-semibold text-white">
                      {groupIndex + 1}
                    </span>
                    <h3 className="text-[15px] font-semibold text-[#171A20]">{group.label}</h3>
                  </div>

                  <div className="grid gap-3">
                    {group.nodes.map((node) => (
                      <div key={node.title} className="border border-[#E6E6E6] bg-white p-4">
                        <p className="mb-2 text-[15px] font-medium text-[#171A20]">
                          {node.title}
                        </p>
                        <p className="text-[13px] leading-[1.55] text-[#5C5E62]">{node.body}</p>
                      </div>
                    ))}
                  </div>

                  {groupIndex < diagramGroups.length - 1 ? (
                    <div className="hidden lg:absolute lg:top-24 lg:-right-4 lg:block">
                      <div className="h-px w-8 bg-[#D0D1D2]" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#EEEEEE] bg-[#F9FAFB] px-6 py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="mb-4 text-[32px] font-medium text-[#171A20]">
              {m.platform_providers_title()}
            </h2>
            <p className="mb-8 text-[16px] leading-[1.75] text-[#5C5E62]">
              {m.platform_providers_description()}
            </p>
            <Link
              to="/demo"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#3E6AE1] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#2E52B5]"
            >
              {m.platform_demo_cta()}
            </Link>
          </div>

          <div className="grid gap-6">
            <ProviderPanel title={m.platform_required_title()} providers={requiredProviders} />
            <ProviderPanel title={m.platform_optional_title()} providers={optionalProviders} />
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-2xl">
            <h2 className="mb-4 text-[32px] font-medium text-[#171A20]">
              {m.platform_sources_title()}
            </h2>
            <p className="text-[16px] leading-[1.75] text-[#5C5E62]">
              {m.platform_sources_description()}
            </p>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-3">
            {documentSources.map((source) => (
              <div
                key={source.detail}
                className="flex min-w-36 flex-1 flex-col items-center border border-[#E6E6E6] bg-white px-4 py-5 text-center"
              >
                <LogoImage provider={source} sizeClassName="h-10 w-10" />
                <h3 className="mt-4 text-[14px] font-medium text-[#171A20]">{source.name}</h3>
                <p className="mt-1 font-mono text-[11px] text-[#8E8E8E]">{source.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function ProviderPanel({ title, providers }: { title: string; providers: Provider[] }) {
  return (
    <div className="border border-[#E6E6E6] bg-white p-5">
      <h3 className="mb-4 text-[18px] font-medium text-[#171A20]">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((provider) => (
          <div key={provider.name} className="flex gap-4 border border-[#EEEEEE] bg-[#FAFAFA] p-4">
            <LogoImage provider={provider} sizeClassName="h-8 w-8" />
            <div>
              <p className="mb-1 text-[14px] font-medium text-[#171A20]">{provider.name}</p>
              <p className="text-[13px] leading-[1.55] text-[#5C5E62]">{provider.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LogoImage({ provider, sizeClassName }: { provider: Provider; sizeClassName: string }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#EEEEEE] bg-white">
      <img src={provider.icon} alt="" aria-hidden="true" className={`${sizeClassName} object-contain`} />
    </span>
  )
}
