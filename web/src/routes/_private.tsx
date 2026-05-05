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

const getPaymentGate = createServerFn({ method: "GET" }).handler(async () => {
  const { eq } = await import("drizzle-orm")
  const { db } = await import("@/db/client")
  const { organizations, users } = await import("@/db/schemas/web")
  const { requireWorkspaceUser } = await import("@/lib/project-authorization.server")
  const user = await requireWorkspaceUser()
  if (user.accountRole === "individual") {
    return {
      ready: user.hasPaymentMethod && user.billingStatus !== "stripe_info_missing",
    }
  }
  const [row] = await db
    .select({
      billingStatus: organizations.billingStatus,
      stripePaymentMethodId: organizations.stripePaymentMethodId,
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .where(eq(users.id, user.userId))
    .limit(1)
  return {
    ready: Boolean(row?.stripePaymentMethodId) && row?.billingStatus !== "stripe_info_missing",
  }
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
    if (location.pathname !== "/billing") {
      const gate = await getPaymentGate()
      if (!gate.ready) {
        throw redirect({
          to: "/billing",
          search: { redirect: location.href },
        })
      }
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
