import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, FileText, Layers, Sparkles, Zap } from "lucide-react"

export const Route = createFileRoute("/_public/")({ component: App })

function App() {
  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-125 w-200 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute top-1/3 left-1/3 h-75 w-100 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300">
            <Sparkles className="h-4 w-4" />
            AI-Powered Document Intelligence
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight mb-6">
            Turn PDFs into{" "}
            <span className="bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              structured data
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto max-w-2xl text-xl text-slate-400 leading-relaxed mb-10">
            Label entities, train models, and automate extraction workflows — all without writing
            code. Dokumen AI reads your PDFs so your team doesn&apos;t have to.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="group flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-lg font-semibold px-8 py-4 rounded-xl shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 hover:scale-105"
            >
              Get Started Free
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/signin"
              className="flex items-center gap-2 text-lg font-semibold text-slate-300 hover:text-white px-8 py-4 rounded-xl border border-slate-600 hover:border-slate-500 hover:bg-white/5 transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
        {/* Gradient transition to next section */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-b from-transparent to-slate-900 pointer-events-none" />
      </section>

      {/* Why Dokumen AI? */}
      <section className="relative py-20 px-6 bg-slate-900">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Why Dokumen AI?</h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* The Problem */}
            <div className="group relative rounded-2xl border border-red-500/20 bg-slate-800/50 p-8 hover:border-red-500/40 transition-all duration-300">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 group-hover:bg-red-500/20 transition-colors">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white">The Problem</h3>
              </div>
              <p className="mb-6 text-base text-slate-400 italic">
                Every business is modernizing big data processes, but what about information that
                isn&apos;t stored in a database or transferred in EDI format?
              </p>
              <ul className="space-y-3">
                <li className="flex gap-3 text-slate-300">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  <span>Most unstructured, confidential information is sent as PDFs.</span>
                </li>
                <li className="flex gap-3 text-slate-300">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  <span>
                    PDFs are read once and discarded, or a human has to spend valuable time
                    recording the details.
                  </span>
                </li>
                <li className="flex gap-3 text-slate-300">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  <span>
                    Even tech-forward businesses rely on analysts to read PDFs and manually enter
                    fields or trigger actions.
                  </span>
                </li>
              </ul>
            </div>

            {/* The Solution */}
            <div className="group relative rounded-2xl border border-emerald-500/20 bg-slate-800/50 p-8 hover:border-emerald-500/40 transition-all duration-300">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white">The Solution</h3>
              </div>
              <p className="mb-6 text-base text-slate-400 italic">
                Dokumen AI automates PDF reading.
              </p>
              <ul className="space-y-3">
                <li className="flex gap-3 text-slate-300">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span>
                    Convert your PDFs into a dataset with our no-code interface for training and
                    testing language models to extract key features.
                  </span>
                </li>
                <li className="flex gap-3 text-slate-300">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span>
                    Finalize automation workflows to execute business logic or mine insights on data
                    you didn&apos;t realize you had.
                  </span>
                </li>
                <li className="flex gap-3 text-slate-300">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span>
                    Pre-built workflows plus customization and integration with your cloud and LLM
                    providers.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything you need to automate PDF workflows
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              From labeling to deployment, Dokumen AI provides the complete toolkit for turning
              unstructured documents into actionable data.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="group relative rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 hover:border-cyan-500/50 transition-all duration-300">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 group-hover:from-cyan-500/30 group-hover:to-blue-500/30 transition-colors">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">No-Code Labeling</h3>
              <p className="text-slate-400 leading-relaxed">
                Visually annotate entities in your PDFs with an intuitive point-and-click interface.
                Define custom entity types for your domain.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group relative rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 hover:border-cyan-500/50 transition-all duration-300">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 group-hover:from-cyan-500/30 group-hover:to-blue-500/30 transition-colors">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">AI-Powered Extraction</h3>
              <p className="text-slate-400 leading-relaxed">
                Train and test language models on your labeled data. Integrate with your preferred
                LLM provider for automated extraction.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group relative rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 hover:border-cyan-500/50 transition-all duration-300">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 group-hover:from-cyan-500/30 group-hover:to-blue-500/30 transition-colors">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Workflow Automation</h3>
              <p className="text-slate-400 leading-relaxed">
                Build end-to-end pipelines that process PDFs automatically. Connect to your cloud
                infrastructure and trigger business logic.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo / Preview Section */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
            <div className="grid md:grid-cols-2 gap-0">
              {/* Left: Description */}
              <div className="p-10 md:p-14 flex flex-col justify-center">
                <div className="mb-4 inline-flex items-center gap-2 text-sm text-cyan-400 font-medium">
                  <FileText className="h-4 w-4" />
                  Interactive Demo
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">See Dokumen AI in action</h2>
                <p className="text-slate-400 leading-relaxed mb-8">
                  Try our PDF labeling demo to experience the workflow firsthand. Upload a PDF,
                  define entity types, and start annotating — all in your browser.
                </p>
                <div>
                  <Link
                    to="/demo"
                    className="group inline-flex items-center gap-2 bg-white text-slate-900 font-semibold px-6 py-3 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    Launch Demo
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>

              {/* Right: Visual Preview */}
              <div className="relative bg-slate-900/80 p-10 md:p-14 flex items-center justify-center min-h-80">
                <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 to-blue-500/5" />
                <div className="relative w-full max-w-sm">
                  {/* Mock PDF Preview */}
                  <div className="rounded-xl border border-slate-700 bg-white shadow-2xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 border-b border-slate-200">
                      <div className="flex gap-1.5">
                        <div className="h-3 w-3 rounded-full bg-red-400" />
                        <div className="h-3 w-3 rounded-full bg-yellow-400" />
                        <div className="h-3 w-3 rounded-full bg-green-400" />
                      </div>
                      <span className="ml-2 text-xs text-slate-500 truncate">
                        invoice_sample.pdf
                      </span>
                    </div>
                    <div className="p-6 space-y-3">
                      <div className="h-3 w-3/4 bg-slate-200 rounded" />
                      <div className="h-3 w-1/2 bg-slate-200 rounded" />
                      <div className="h-3 w-5/6 bg-slate-200 rounded" />
                      <div className="mt-4 flex gap-2">
                        <span className="inline-block rounded-md bg-cyan-100 text-cyan-700 text-xs font-medium px-2 py-1">
                          Vendor
                        </span>
                        <span className="inline-block rounded-md bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-1">
                          Amount
                        </span>
                        <span className="inline-block rounded-md bg-amber-100 text-amber-700 text-xs font-medium px-2 py-1">
                          Date
                        </span>
                      </div>
                      <div className="h-3 w-2/3 bg-slate-200 rounded" />
                      <div className="h-3 w-4/5 bg-slate-200 rounded" />
                      <div className="h-3 w-1/3 bg-slate-200 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to automate your PDF workflows?
          </h2>
          <p className="text-lg text-slate-400 mb-8">
            Join teams that are saving hours of manual data entry every week.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="group flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-lg font-semibold px-8 py-4 rounded-xl shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 hover:scale-105"
            >
              Create Free Account
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/demo"
              className="flex items-center gap-2 text-lg font-semibold text-slate-300 hover:text-white px-8 py-4 rounded-xl border border-slate-600 hover:border-slate-500 hover:bg-white/5 transition-all"
            >
              Try the Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
