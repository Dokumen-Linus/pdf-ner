import { createFileRoute } from "@tanstack/react-router"
import EntityTable from "../../components/entity-table/components/entity-table"
import PDFContainer from "../../components/pdf-container/pdf-container"

export const Route = createFileRoute("/_public/demo")({
  component: DemoPage,
})

function DemoPage() {
  return (
    <div className="flex flex-row h-screen w-full gap-4 p-4">
      {/* <PluginStoreTable /> */}
      {/* <SaveLabelsButton /> */}
      <div className="flex-1 h-full">
        <PDFContainer
          url="https://raw.githubusercontent.com/optimalcharb/pdf-entity-labeling/cdc90a5392c72982e80c9bf08e330d7b05d29c5d/public/example-pdfs/federal-register/2025-19982_first_page.pdf"
          exportName="labeled_2025-19982_first_page.pdf"
          author="anonymous"
        />
      </div>
      <div className="w-1/3 min-w-[300px] h-full overflow-auto">
        <EntityTable />
      </div>
    </div>
  )
}
