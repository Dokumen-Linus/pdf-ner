import { createFileRoute, Link } from "@tanstack/react-router"
import { z } from "zod"

import { Button } from "@/components/shadcn-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/shadcn-ui/card"
import { getLocale } from "@/integrations/paraglide/runtime"
import { getAuthErrorPageCopy, getLocalizedAuthRedirectError } from "@/lib/auth-i18n"

export const Route = createFileRoute("/_auth/error")({
  validateSearch: z.object({
    error: z.string().optional(),
    error_description: z.string().optional(),
  }),
  component: AuthErrorPage,
})

function AuthErrorPage() {
  const locale = getLocale()
  const copy = getAuthErrorPageCopy(locale)
  const { error, error_description: errorDescription } = Route.useSearch()
  const localizedError = getLocalizedAuthRedirectError(error, locale)
  const description = localizedError || errorDescription || copy.unknownError

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-[#EEEEEE] bg-[#FAFAFA] p-4">
            <p className="text-base leading-6 font-medium text-[#171A20]">{description}</p>
          </div>
          {error ? (
            <p className="text-muted-foreground text-sm">
              {copy.errorCodeLabel}: <code>{error}</code>
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button asChild>
            <Link to="/signin">{copy.tryAgain}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">{copy.goHome}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
