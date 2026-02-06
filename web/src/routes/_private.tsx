import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { auth } from "@/lib/auth"

export const Route = createFileRoute("/_private")({
  beforeLoad: async ({ location }) => {
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
      <Outlet />
    </>
  )
}
