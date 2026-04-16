import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import Header from "@/components/public-site/header"
import { SidebarProvider } from "@/components/shadcn-ui/sidebar"
import { getCookie } from "@/lib/cookies"

// Server-only session lookup from request headers. createServerFn handler
// bodies are stripped from the client bundle, so `@tanstack/react-start/server`
// and `@/lib/auth` never enter client code.
const getServerSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequestHeaders } = await import("@tanstack/react-start/server")
  const { auth } = await import("@/lib/auth")
  const headers = getRequestHeaders()
  return auth.api.getSession({ headers })
})

export const Route = createFileRoute("/_private")({
  beforeLoad: async ({ location }) => {
    let session
    if (import.meta.env.SSR) {
      session = await getServerSession()
    } else {
      const { authClient } = await import("@/lib/auth-client")
      const { data } = await authClient.getSession()
      session = data
    }
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
      <div className="flex min-h-svh w-full flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  )
}
