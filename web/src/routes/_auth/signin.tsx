import { useState } from "react"
import { useForm } from "@tanstack/react-form"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
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
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import { Separator } from "@/components/shadcn-ui/separator"
import { m } from "@/integrations/paraglide/messages.js"
import { authClient } from "@/lib/auth-client"

type SocialProvider = "microsoft" | "google"

export const Route = createFileRoute("/_auth/signin")({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  component: SignInPage,
})

function SignInPage() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
  const [socialError, setSocialError] = useState<string | null>(null)
  const [pendingSocialProvider, setPendingSocialProvider] = useState<SocialProvider | null>(null)
  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmitAsync: async ({ value }) => {
        const { error } = await authClient.signIn.email({
          email: value.email,
          password: value.password,
        })

        if (error) {
          return {
            form: error.message || m.auth_signin_error_fallback(),
          }
        }

        await navigate({ to: redirect ?? "/profile" })
        return null
      },
    },
  })

  const handleSocialSignIn = async (provider: SocialProvider) => {
    setSocialError(null)
    setPendingSocialProvider(provider)
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: redirect ?? "/profile",
      errorCallbackURL: "/error",
    })

    if (error) {
      setSocialError(error.message || m.auth_signin_error_fallback())
      setPendingSocialProvider(null)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{m.auth_signin_title()}</CardTitle>
          <CardDescription>{m.auth_signin_description()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pendingSocialProvider !== null}
              onClick={() => void handleSocialSignIn("microsoft")}
            >
              {m.auth_microsoft_button()}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pendingSocialProvider !== null}
              onClick={() => void handleSocialSignIn("google")}
            >
              {m.auth_google_button()}
            </Button>
            {socialError ? (
              <p className="text-destructive text-sm font-medium">{socialError}</p>
            ) : null}
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs">{m.auth_email_separator()}</span>
              <Separator className="flex-1" />
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
            className="space-y-4"
          >
            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => (!value ? m.auth_signin_email_required() : undefined),
              }}
              children={({ state, handleChange, handleBlur }) => (
                <div className="space-y-2">
                  <Label htmlFor="email">{m.auth_signin_email_label()}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={m.auth_signin_email_placeholder()}
                    value={state.value}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={handleBlur}
                  />
                  {state.meta.errors.length > 0 && (
                    <p className="text-destructive text-sm font-medium">
                      {state.meta.errors.join(", ")}
                    </p>
                  )}
                </div>
              )}
            />

            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) => (!value ? m.auth_signin_password_required() : undefined),
              }}
              children={({ state, handleChange, handleBlur }) => (
                <div className="space-y-2">
                  <Label htmlFor="password">{m.auth_signin_password_label()}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={state.value}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={handleBlur}
                  />
                  {state.meta.errors.length > 0 && (
                    <p className="text-destructive text-sm font-medium">
                      {state.meta.errors.join(", ")}
                    </p>
                  )}
                </div>
              )}
            />

            <form.Subscribe
              selector={(state) => [state.errorMap]}
              children={([errorMap]) =>
                errorMap.onSubmit ? (
                  <p className="text-destructive text-sm font-medium">
                    {(errorMap.onSubmit as { form?: string })?.form ?? String(errorMap.onSubmit)}
                  </p>
                ) : null
              }
            />

            <Button type="submit" className="w-full" disabled={form.state.isSubmitting}>
              {form.state.isSubmitting ? m.auth_signin_button_loading() : m.auth_signin_button()}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-muted-foreground text-sm">
            {m.auth_signin_footer_text()}{" "}
            <Link
              to="/signup"
              search={redirect ? { redirect } : undefined}
              className="text-primary hover:underline"
            >
              {m.auth_signin_footer_link()}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
