import { createFileRoute } from "@tanstack/react-router"

import EntityTable from "@/components/entity-table/components/entity-table"
import PDFContainer from "@/components/pdf-container/pdf-container"
import demoEntityTypes from "@/lib/demo/demo-entity-types"

export const Route = createFileRoute("/_public/demo")({
  component: DemoPage,
})

function DemoPage() {
  return (
    <div className="flex h-screen w-full flex-row gap-4 p-4">
      <div className="h-full flex-1">
        <PDFContainer
          initalDocuments={[
            {
              name: "Federal Register 2025-21665.pdf",
              url: "https://raw.githubusercontent.com/optimalcharb/pdf-entity-labeling/feaa8873a60883cf072a604383e6986f8ca82285/public/example-pdfs/federal-register/2025-21665.pdf",
              autoActivate: false,
            },
            {
              name: "Federal Register 2025-21767.pdf",
              url: "https://raw.githubusercontent.com/optimalcharb/pdf-entity-labeling/master/public/example-pdfs/federal-register/2025-21767_first_page.pdf",
              autoActivate: false,
            },
          ]}
          allEntityTypes={demoEntityTypes}
          canRotate={false}
        />
      </div>
      <div className="h-full w-1/3 min-w-75 overflow-auto">
        <EntityTable entityTypes={demoEntityTypes} />
      </div>
    </div>
  )
}
