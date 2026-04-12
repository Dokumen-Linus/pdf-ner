import { Link } from "@tanstack/react-router"
import { Button } from "./shadcn-ui/button"
import { m } from "@/paraglide/messages.js"

export function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">{m.notfound_title()}</h1>
        <p className="text-gray-500 dark:text-gray-400">
          {m.notfound_description()}
        </p>
      </div>
      <Link to="/">
        <Button>{m.notfound_button()}</Button>
      </Link>
    </div>
  )
}
