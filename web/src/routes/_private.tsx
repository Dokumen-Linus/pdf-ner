import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import Header from "@/components/public-site/header"

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
      return { session }
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
    return { session }
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  )
}
