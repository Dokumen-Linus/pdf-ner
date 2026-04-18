import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/_public/about")({
  component: AboutPage,
})

function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-[#F4F4F4] px-6 py-24">
        <div className="mx-auto flex max-w-5xl flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-4 text-[13px] font-semibold tracking-[0.18em] text-[#3E6AE1] uppercase">
              About
            </p>
            <h1 className="mb-6 text-[40px] leading-[1.15] font-medium text-[#171A20]">
              Built to make PDF extraction feel clear, practical, and reliable.
            </h1>
            <p className="max-w-xl text-[16px] leading-[1.7] text-[#5C5E62]">
              Dokumen AI helps teams upload documents, define the fields they care about, and turn
              messy PDFs into structured data without heavyweight setup.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:max-w-md">
            {[
              ["Fast setup", "Create a project, upload files, and start annotating in minutes."],
              ["Human review", "Keep people in the loop while building extraction confidence."],
            ].map(([title, body]) => (
              <div key={title} className="border border-[#E6E6E6] bg-white p-5">
                <h2 className="mb-2 text-[16px] font-medium text-[#171A20]">{title}</h2>
                <p className="text-[14px] leading-[1.6] text-[#5C5E62]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="mb-4 text-[32px] font-medium text-[#171A20]">Why this exists</h2>
            <p className="mb-6 max-w-2xl text-[16px] leading-[1.8] text-[#5C5E62]">
              Many document workflows still depend on copy-paste, fragile templates, or expensive
              custom builds. This product is meant to close that gap with a cleaner workflow for
              teams who need repeatable extraction from real-world PDFs.
            </p>
            <p className="max-w-2xl text-[16px] leading-[1.8] text-[#5C5E62]">
              The goal is simple: keep the interface approachable, let models do the heavy lifting,
              and give users enough control to review, correct, and improve results over time.
            </p>
          </div>

          <div className="grid gap-4">
            {[
              ["Upload", "Bring in contracts, invoices, forms, and reports."],
              ["Label", "Mark the entities you want once and reuse them across projects."],
              ["Extract", "Run models, compare outputs, and export structured results."],
            ].map(([title, body], index) => (
              <div key={title} className="flex gap-4 border border-[#EEEEEE] bg-[#FAFAFA] p-5">
                <span className="text-[13px] font-semibold text-[#3E6AE1]">0{index + 1}</span>
                <div>
                  <h3 className="mb-1 text-[16px] font-medium text-[#171A20]">{title}</h3>
                  <p className="text-[14px] leading-[1.6] text-[#5C5E62]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#EEEEEE] bg-[#F9FAFB] px-6 py-24">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <h2 className="mb-4 text-[32px] font-medium text-[#171A20]">Founded by Charlie</h2>
          <p className="mb-10 max-w-xl text-[16px] leading-[1.7] text-[#5C5E62]">
            Charlie started Dokumen AI to make document extraction simpler for teams that need
            clean, structured data from messy PDFs without adding unnecessary complexity.
          </p>

          {/* Replace this src with your own image in web/public/ to show your photo here. */}
          <img
            src="/about-photo-placeholder.svg"
            alt="Charlie"
            className="h-48 w-48 rounded-full border border-[#DADDE1] object-cover shadow-[0_18px_40px_rgba(23,26,32,0.08)]"
          />

          <Link
            to="/signup"
            className="mt-10 flex min-h-10 items-center justify-center rounded-lg bg-[#3E6AE1] px-6 text-[14px] font-medium text-white transition-colors hover:bg-[#2E52B5]"
          >
            Get started
          </Link>
        </div>
      </section>
    </div>
  )
}
