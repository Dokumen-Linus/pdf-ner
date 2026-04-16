import { createFileRoute } from "@tanstack/react-router"
import EntityTable from "@/components/entity-table/components/entity-table"
import PDFContainer from "@/components/pdf-container/pdf-container"
import { m } from "@/integrations/paraglide/messages.js"
import demoEntityTypes from "@/lib/demo/demo-entity-types"

export const Route = createFileRoute("/_public/demo")({
  component: DemoPage,
})

function DemoPage() {
  return (
    <div className="flex flex-row h-screen w-full gap-4 p-4">
      <div className="flex-1 h-full">
        <PDFContainer
          initalDocuments={[
            {
              name: "Federal Register 2025-19982",
              url: "https://raw.githubusercontent.com/optimalcharb/pdf-entity-labeling/cdc90a5392c72982e80c9bf08e330d7b05d29c5d/public/example-pdfs/federal-register/2025-19982_first_page.pdf",
            },
            {
              name: "Federal Register 2025-21665",
              url: "https://raw.githubusercontent.com/optimalcharb/pdf-entity-labeling/feaa8873a60883cf072a604383e6986f8ca82285/public/example-pdfs/federal-register/2025-21665.pdf",
              autoActivate: false,
            },
            {
              name: "Federal Register 2025-21767",
              url: "https://raw.githubusercontent.com/optimalcharb/pdf-entity-labeling/master/public/example-pdfs/federal-register/2025-21767_first_page.pdf",
              autoActivate: false,
            },
          ]}
          exportName={m.demo_export_name()}
          author={m.demo_author_fallback()}
          canRotate={false}
        />
      </div>
      <div className="w-1/3 min-w-75 h-full overflow-auto">
        <EntityTable entityTypes={demoEntityTypes} />
      </div>
    </div>
  )
}
