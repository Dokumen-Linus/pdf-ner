import { useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Loader2 } from "@/components/icons"
import { m } from "@/integrations/paraglide/messages.js"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/_auth/signout")({
  component: SignOutPage,
})

function SignOutPage() {
  useEffect(() => {
    const signOut = async () => {
      await authClient.signOut()
      window.location.href = "/"
    }
    signOut()
  }, [])

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
      <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      <p className="text-muted-foreground">{m.auth_signout_loading()}</p>
    </div>
  )
}
