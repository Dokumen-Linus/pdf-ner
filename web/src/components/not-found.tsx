import { Link } from "@tanstack/react-router"
import { Button } from "./shadcn-ui/button"

export function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">404 - Page Not Found</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Oops! The page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <Link to="/">
        <Button>Go back home</Button>
      </Link>
    </div>
  )
}
