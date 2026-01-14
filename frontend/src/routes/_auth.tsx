import { createFileRoute, Outlet } from "@tanstack/react-router"
import Header from "@/components/public-site/header"

export const Route = createFileRoute("/_auth")({
  component: () => (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  ),
})
