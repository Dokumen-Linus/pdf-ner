import { redirect } from "@tanstack/react-router"
import { createMiddleware } from "@tanstack/react-start"

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const _request = request // for linting
  const [{ getRequestHeaders }, { auth }] = await Promise.all([
    import("@tanstack/react-start/server"),
    import("@/lib/auth"),
  ])
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session) {
    throw redirect({ to: "/signin" })
  }
  return await next()
})
