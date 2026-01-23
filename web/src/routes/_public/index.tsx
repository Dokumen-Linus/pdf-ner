import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_public/")({ component: App })

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <section className="relative py-20 px-6 text-center overflow-hidden">
        {/* Problem/Solution Section */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* The Problem */}
          <div className="group relative">
            <div className="absolute inset-0 rotate-1 transform rounded-3xl bg-gradient-to-br from-red-100 via-orange-50 to-yellow-100 transition-transform duration-300 group-hover:rotate-0"></div>
            <div className="relative rounded-3xl border border-red-200/50 bg-gradient-to-br from-red-50/90 via-white/95 to-orange-50/90 p-8 shadow-xl backdrop-blur-sm transition-all duration-300 hover:shadow-2xl">
              <div className="mb-6 flex items-center">
                <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg">
                  <svg
                    className="h-6 w-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h2 className="bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-3xl font-bold text-transparent">
                  The Problem
                </h2>
              </div>
              <div className="mb-4">
                <p className="mb-4 text-lg font-medium text-gray-600 italic">
                  Every business is modernizing big data processes, but what about information that
                  isn't stored in a database or transfered in EDI format?
                </p>
              </div>
              <div className="space-y-4">
                <p className="text-lg leading-relaxed text-gray-700">
                  Most unstructured, confidential information is sent as PDFs.
                </p>
                <p className="text-lg leading-relaxed text-gray-700">
                  PDFs are read once and discarded. Or a human has to spend valuable time recording
                  the PDF details.
                </p>
                <p className="text-lg leading-relaxed text-gray-700">
                  Even tech-forward businesses rely on analysts to read PDFs and enter fields or
                  trigger actions in their software systems.
                </p>
              </div>
            </div>
          </div>

          {/* The Solution */}
          <div className="group relative">
            <div className="absolute inset-0 -rotate-1 transform rounded-3xl bg-gradient-to-br from-emerald-100 via-green-50 to-teal-100 transition-transform duration-300 group-hover:rotate-0"></div>
            <div className="relative rounded-3xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/90 via-white/95 to-green-50/90 p-8 shadow-xl backdrop-blur-sm transition-all duration-300 hover:shadow-2xl">
              <div className="mb-6 flex items-center">
                <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 shadow-lg">
                  <svg
                    className="h-6 w-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <h2 className="bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-3xl font-bold text-transparent">
                  The Solution
                </h2>
              </div>
              <div className="mb-4">
                <p className="mb-4 text-lg font-medium text-gray-600 italic">
                  Dokumen AI automates PDF reading.
                </p>
              </div>
              <div className="space-y-4">
                <p className="text-lg leading-relaxed text-gray-700">
                  Convert your PDFs into a dataset without our no-code interface for training and
                  testing language models to extract key features.
                </p>
                <p className="text-lg leading-relaxed text-gray-700">
                  From there, you can easily finalize an automation workflow to execute your
                  business logic or mine insights on data you didn't realize you had.
                </p>
                <p className="text-lg leading-relaxed text-gray-700">
                  Dokumen AI provides efficient, effective pre-built workflows plus customization
                  and integration with your cloud and LLM providers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
