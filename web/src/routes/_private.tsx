import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import Header from "@/components/public-site/header"
import { SidebarProvider } from "@/components/shadcn-ui/sidebar"
import { getCookie } from "@/lib/cookies"

export const Route = createFileRoute("/_private")({
  beforeLoad: async ({ location }) => {
    if (!import.meta.env.SSR) {
      const { authClient } = await import("@/lib/auth-client")
      const { data: session } = await authClient.getSession()
      if (!session?.user) {
        throw redirect({
          to: "/signin",
          search: { redirect: location.href },
        })
      }
      return { session, sidebarOpen: getCookie("sidebar_state", "true") === "true" }
    }

    const [{ getRequestHeaders }, { auth }] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("@/lib/auth"),
    ])
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })
    if (!session?.user) {
      throw redirect({
        to: "/signin",
        search: { redirect: location.href },
      })
    }
    return { session, sidebarOpen: getCookie("sidebar_state", "true") === "true" }
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  const { sidebarOpen } = Route.useRouteContext()
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <Header />
      <main>
        <Outlet />
      </main>
    </SidebarProvider>
  )
}
