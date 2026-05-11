import { useState } from "react"
import { useForm } from "@tanstack/react-form"
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
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import { Separator } from "@/components/shadcn-ui/separator"
import { getUserByEmail, updateUserByAuthUserId } from "@/db-fns/web/users"
import { m } from "@/integrations/paraglide/messages.js"
import { authClient } from "@/lib/auth-client"
import { getPostVerificationRedirect } from "@/lib/auth-redirects"

export const Route = createFileRoute("/_auth/signup")({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  component: SignUpPage,
})

function SignUpPage() {
  const [isSuccess, setIsSuccess] = useState(false)
  const [socialError, setSocialError] = useState<string | null>(null)
  const [isMicrosoftPending, setIsMicrosoftPending] = useState(false)
  const { redirect } = Route.useSearch()
  const verificationCallbackURL = getPostVerificationRedirect(redirect)
  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      employer: "",
      jobTitle: "",
    },
    validators: {
      onSubmit: ({ value }) => {
        if (value.password !== value.confirmPassword) {
          return {
            form: m.auth_signup_passwords_mismatch(),
            fields: {
              confirmPassword: m.auth_signup_passwords_mismatch(),
            },
          }
        }
      },
      onSubmitAsync: async ({ value }) => {
        const fullName = `${value.firstName} ${value.lastName}`.trim()

        const { data, error: authError } = await authClient.signUp.email({
          email: value.email,
          password: value.password,
          name: fullName,
          callbackURL: verificationCallbackURL,
        })

        if (authError) {
          return {
            form: authError.message || m.auth_signup_error_fallback(),
          }
        }

        if (data?.user?.id) {
          try {
            await updateUserByAuthUserId({
              data: {
                authUserId: data.user.id,
                displayName: fullName || undefined,
                firstName: value.firstName || undefined,
                lastName: value.lastName || undefined,
                employer: value.employer || undefined,
                jobTitle: value.jobTitle || undefined,
              },
            })
          } catch (error) {
            console.warn("[signup] profile bootstrap failed", error)
          }
        }

        setIsSuccess(true)
        return null
      },
    },
  })

  const handleMicrosoftSignIn = async () => {
    setSocialError(null)
    setIsMicrosoftPending(true)
    const { error } = await authClient.signIn.social({
      provider: "microsoft",
      callbackURL: redirect ?? "/profile",
      errorCallbackURL: "/error",
    })

    if (error) {
      setSocialError(error.message || m.auth_signup_error_fallback())
      setIsMicrosoftPending(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="my-8 flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-2xl">{m.auth_signup_success_title()}</CardTitle>
            <CardDescription>{m.auth_signup_success_description()}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">{m.auth_signup_success_content()}</p>
            <Link to="/signin" search={redirect ? { redirect } : undefined}>
              <Button className="w-full">{m.auth_signup_success_button()}</Button>
            </Link>
            <p className="text-muted-foreground mt-2 text-center text-xs">
              {m.auth_signup_success_footer()}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="my-8 flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">{m.auth_signup_title()}</CardTitle>
          <CardDescription>{m.auth_signup_description()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isMicrosoftPending}
              onClick={() => void handleMicrosoftSignIn()}
            >
              {m.auth_microsoft_button()}
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
            <div className="grid grid-cols-2 gap-4">
              <form.Field
                name="firstName"
                validators={{
                  onChange: ({ value }) =>
                    !value ? m.auth_signup_firstname_required() : undefined,
                }}
                children={({ state, handleChange, handleBlur }) => (
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{m.auth_signup_firstname_label()}</Label>
                    <Input
                      id="firstName"
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
                name="lastName"
                validators={{
                  onChange: ({ value }) => (!value ? m.auth_signup_lastname_required() : undefined),
                }}
                children={({ state, handleChange, handleBlur }) => (
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{m.auth_signup_lastname_label()}</Label>
                    <Input
                      id="lastName"
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
            </div>
            <form.Field
              name="employer"
              children={({ state, handleChange, handleBlur }) => (
                <div className="space-y-2">
                  <Label htmlFor="employer">{m.auth_signup_employer_label()}</Label>
                  <Input
                    id="employer"
                    value={state.value}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={handleBlur}
                  />
                </div>
              )}
            />
            <form.Field
              name="jobTitle"
              children={({ state, handleChange, handleBlur }) => (
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">{m.auth_signup_jobtitle_label()}</Label>
                  <Input
                    id="jobTitle"
                    value={state.value}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={handleBlur}
                  />
                </div>
              )}
            />
            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return m.auth_signup_email_required()
                  if (!/\S+@\S+\.\S+/.test(value)) return m.auth_signup_email_invalid()
                  return undefined
                },
                onChangeAsync: async ({ value }) => {
                  try {
                    const user = await getUserByEmail({ data: { email: value } })
                    if (user) return m.auth_signup_email_exists()
                  } catch (_e) {}
                },
              }}
              children={({ state, handleChange, handleBlur }) => (
                <div className="space-y-2">
                  <Label htmlFor="email">{m.auth_signup_email_label()}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={m.auth_signup_email_placeholder()}
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
                onChange: ({ value }) => {
                  if (!value) return m.auth_signup_password_required()
                  if (value.length < 8) return m.auth_signup_password_min()
                  if (!/[A-Z]/.test(value)) return m.auth_signup_password_uppercase()
                  if (!/[a-z]/.test(value)) return m.auth_signup_password_lowercase()
                  if (!/[0-9]/.test(value)) return m.auth_signup_password_number()
                  if (!/[\W_]/.test(value)) return m.auth_signup_password_special()
                  return undefined
                },
              }}
              children={({ state, handleChange, handleBlur }) => (
                <div className="space-y-2">
                  <Label htmlFor="password">{m.auth_signup_password_label()}</Label>
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
            <form.Field
              name="confirmPassword"
              validators={{
                onChange: ({ value }) =>
                  !value ? m.auth_signup_confirmpassword_required() : undefined,
              }}
              children={({ state, handleChange, handleBlur }) => (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{m.auth_signup_confirmpassword_label()}</Label>
                  <Input
                    id="confirmPassword"
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
              {form.state.isSubmitting ? m.auth_signup_button_loading() : m.auth_signup_button()}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-muted-foreground text-sm">
            {m.auth_signup_footer_text()}{" "}
            <Link
              to="/signin"
              search={redirect ? { redirect } : undefined}
              className="text-primary hover:underline"
            >
              {m.auth_signup_footer_link()}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
