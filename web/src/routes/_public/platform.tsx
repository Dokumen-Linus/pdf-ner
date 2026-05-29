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
    detail: "VPC, EC2, ECR, RDS, ElastiCache, S3, SES, and Secrets Manager.",
    icon: "/icons/aws-color.svg",
  },
  {
    name: "Cloudflare",
    detail: "DNS, SSL, DDoS, load balancing, rate limits, and WAF.",
    icon: "/icons/cloudflare-color.svg",
  },
  {
    name: "GitHub",
    detail: "Source control and CI/CD through GitHub Actions.",
    icon: "/icons/github.svg",
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

type ServiceDetail = {
  service: string
  category: string
}

const requiredServiceDetails: ServiceDetail[] = [
  { service: "Stripe", category: "Payments" },
  {
    service: "Cloudflare Networking",
    category: "DNS, SSL, DDoS, load balancing, rate limits",
  },
  { service: "Cloudflare WAF", category: "Edge security firewall" },
  { service: "AWS VPC", category: "Full-stack networking" },
  { service: "GitHub", category: "Source control" },
  { service: "GitHub Actions", category: "CI/CD" },
  { service: "AWS ECR", category: "Container image registries" },
  { service: "AWS Secrets Manager", category: "Secrets management" },
  { service: "AWS EC2", category: "CPU compute" },
  { service: "Runpod.io", category: "GPU compute" },
  { service: "AWS RDS", category: "Managed database" },
  { service: "AWS ElastiCache", category: "Managed cache" },
  { service: "AWS S3", category: "PDF storage" },
  { service: "AWS SES", category: "Emails" },
]

type TechStackItem = {
  name: string
  category: string
}

const techStackItems: TechStackItem[] = [
  { name: "Docker + Compose", category: "Container orchestration" },
  { name: "PostgreSQL", category: "Database" },
  { name: "Redis", category: "Cache" },
  { name: "OpenTelemetry", category: "Observability" },
  { name: "TypeScript", category: "Frontend language" },
  { name: "Node.js", category: "Frontend runtime" },
  { name: "Bun.js", category: "Frontend package manager" },
  { name: "Tanstack React Start", category: "Web app framework" },
  { name: "Cloudflare Tunnel", category: "HTTPS reverse proxy" },
  { name: "PDFium", category: "PDF engine for frontend and backend" },
  { name: "CPython", category: "Backend language" },
  { name: "Uvicorn", category: "Backend runtime and package manager" },
  { name: "FastAPI", category: "API framework" },
  { name: "Celery", category: "Workers framework" },
]

const optionalProviders: Provider[] = [
  {
    name: "Google",
    detail: "Optional authentication, Google Deepmind inference, Drive, GCS, and Gmail.",
    icon: "/icons/google.svg",
  },
  {
    name: "Microsoft",
    detail: "Optional authentication, OneDrive, Azure Blob, and Outlook integrations.",
    icon: "/icons/microsoft.svg",
  },
  {
    name: "OpenAI",
    detail: "Optional AI inference provider through Bring Your Own Key.",
    icon: "/icons/openai.svg",
  },
  {
    name: "Anthropic",
    detail: "Optional AI inference provider through Bring Your Own Key.",
    icon: "/icons/anthropic.svg",
  },
]

const documentSources: Provider[] = [
  {
    name: "External AWS S3",
    detail: "external_aws_s3",
    icon: "/icons/aws-color.svg",
  },
  {
    name: "Google Drive",
    detail: "google_drive",
    icon: "/icons/google-drive.svg",
  },
  {
    name: "Google Cloud Storage",
    detail: "gcs",
    icon: "/icons/google-cloud.svg",
  },
  {
    name: "Gmail",
    detail: "gmail",
    icon: "/icons/gmail.svg",
  },
  {
    name: "Microsoft OneDrive",
    detail: "microsoft_onedrive",
    icon: "/icons/onedrive.svg",
  },
  {
    name: "Azure Blob Storage",
    detail: "azure_blob",
    icon: "/icons/azure-blob.svg",
  },
  {
    name: "Outlook",
    detail: "outlook",
    icon: "/icons/outlook.svg",
  },
]

const diagramGroups: Array<{ label: string; nodes: DiagramNode[] }> = [
  {
    label: "Experience",
    nodes: [
      {
        title: "Public web app",
        body: "Tanstack React Start app served by Node.js for public pages, auth, projects, billing, demos, and document UI.",
      },
      {
        title: "FastAPI",
        body: "Python API boundary for upload, avatar, PDF utility, OCR, extraction, telemetry, and health routes.",
      },
    ],
  },
  {
    label: "Processing",
    nodes: [
      {
        title: "Workers",
        body: "Celery orchestration for document workflows, source watching, text extraction, and entity workflows.",
      },
      {
        title: "Runpod GPU services",
        body: "Accelerated AI/ML inference and training workloads for document-heavy OCR and model serving.",
      },
    ],
  },
  {
    label: "AWS state",
    nodes: [
      {
        title: "PostgreSQL and Redis",
        body: "RDS stores application data while ElastiCache provides managed cache capacity.",
      },
      {
        title: "S3 and Secrets Manager",
        body: "S3 stores PDFs while Secrets Manager keeps deployment and integration secrets out of application code.",
      },
    ],
  },
  {
    label: "Edges",
    nodes: [
      {
        title: "Cloudflare",
        body: "DNS, SSL, DDoS protection, load balancing, rate limits, WAF, and Tunnel in front of the app.",
      },
      {
        title: "Optional integrations",
        body: "Google, Microsoft, OpenAI, and Anthropic are optional for auth, AI inference, and source connectivity.",
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
              Dokumen connects document sources, AI inference, AWS storage, billing, and edge
              security into one operating layer for turning PDFs into structured data.
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
                        <p className="mb-2 text-[15px] font-medium text-[#171A20]">{node.title}</p>
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
              Dokumen relies on 5 required providers: Stripe, Cloudflare, GitHub, AWS, and Runpod.
              Google, Microsoft, OpenAI, and Anthropic are optional integrations.
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

            <div className="border border-[#E6E6E6] bg-white p-5">
              <h3 className="mb-4 text-[18px] font-medium text-[#171A20]">
                {m.platform_services_title()}
              </h3>
              <p className="mb-4 text-[13px] leading-[1.55] text-[#5C5E62]">
                Dokumen limits service providers and external APIs to reduce security risk. The
                platform only uses 5 required providers: Stripe, Cloudflare, GitHub, AWS, and
                Runpod.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#EEEEEE] text-[11px] font-semibold tracking-[0.08em] text-[#8E8E8E] uppercase">
                      <th className="py-2 pr-4">Service</th>
                      <th className="py-2">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requiredServiceDetails.map((s) => (
                      <tr key={s.service} className="border-b border-[#EEEEEE] last:border-0">
                        <td className="py-2 pr-4 font-medium text-[#171A20]">{s.service}</td>
                        <td className="py-2 text-[#5C5E62]">{s.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-[#E6E6E6] bg-white p-5">
              <h3 className="mb-4 text-[18px] font-medium text-[#171A20]">
                {m.platform_capacities_title()}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#EEEEEE] text-[11px] font-semibold tracking-[0.08em] text-[#8E8E8E] uppercase">
                      <th className="py-2 pr-4">Capability</th>
                      <th className="py-2">Providers</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#EEEEEE]">
                      <td className="py-2 pr-4 font-medium text-[#171A20]">Authentication</td>
                      <td className="py-2 text-[#5C5E62]">Dokumen, Google, Microsoft</td>
                    </tr>
                    <tr className="border-b border-[#EEEEEE]">
                      <td className="py-2 pr-4 font-medium text-[#171A20]">AI inference</td>
                      <td className="py-2 text-[#5C5E62]">
                        Dokumen, OpenAI, Anthropic, Google Deepmind
                      </td>
                    </tr>
                    <tr className="border-b border-[#EEEEEE]">
                      <td className="py-2 pr-4 font-medium text-[#171A20]">PDF storage</td>
                      <td className="py-2 text-[#5C5E62]">
                        Dokumen, external AWS S3, Google Drive, GCS, Gmail, Microsoft OneDrive,
                        Azure Blob, Outlook
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-[13px] leading-[1.55] text-[#5C5E62]">
                Dokumen supports Bring Your Own Key (BYOK) for AI inference. The web app does not
                yet allow users to upload keys, but you can contact us to provide keys for your
                organization through a separate secure method.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-2xl">
            <h2 className="mb-4 text-[32px] font-medium text-[#171A20]">
              {m.platform_techstack_title()}
            </h2>
            <p className="text-[16px] leading-[1.75] text-[#5C5E62]">
              {m.platform_techstack_description()}
            </p>
          </div>

          <div className="overflow-hidden border border-[#E6E6E6] bg-[#FAFAFA]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#E6E6E6] bg-[#F4F4F4] text-[11px] font-semibold tracking-[0.08em] text-[#8E8E8E] uppercase">
                    <th className="px-5 py-3">Dependencies</th>
                    <th className="px-5 py-3">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {techStackItems.map((item) => (
                    <tr key={item.name} className="border-b border-[#E6E6E6] last:border-0">
                      <td className="px-5 py-3 font-medium text-[#171A20]">{item.name}</td>
                      <td className="px-5 py-3 text-[#5C5E62]">{item.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              PDF storage can use Dokumen storage or optional external sources. External PDF storage
              integrations are listed in the infrastructure knowledge base as planned but not yet
              complete.
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
      <img
        src={provider.icon}
        alt=""
        aria-hidden="true"
        className={`${sizeClassName} object-contain`}
      />
    </span>
  )
}
