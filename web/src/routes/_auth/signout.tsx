import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router"
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";


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
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">Signing out...</p>
    </div>
  )
}