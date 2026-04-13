import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_public/demo")({
  component: DemoPage,
})

function DemoPage() {
  return (
    <div className="flex flex-row h-screen w-full gap-4 p-4">
      <p>Demo Page</p>
    </div>
  )
}
