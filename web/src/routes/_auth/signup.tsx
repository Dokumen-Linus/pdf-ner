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
import { createUser, deleteUserByEmail, getUserByEmail } from "@/db-fns/web/users"
import { authClient } from "@/lib/auth-client"
import { getPostVerificationRedirect } from "@/lib/auth-redirects"
import { m } from "@/integrations/paraglide/messages.js"

export const Route = createFileRoute("/_auth/signup")({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  component: SignUpPage,
})

function SignUpPage() {
  const [isSuccess, setIsSuccess] = useState(false)
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
            form: "Passwords do not match",
            fields: {
              confirmPassword: "Passwords do not match",
            },
          }
        }
      },
      onSubmitAsync: async ({ value }) => {
        // 1. Create User Profile
        try {
          await createUser({
            data: {
              email: value.email,
              firstName: value.firstName,
              lastName: value.lastName,
              employer: value.employer || undefined,
              jobTitle: value.jobTitle || undefined,
            },
          })
        } catch (_error) {
          return {
            form: "We couldn't complete sign up right now. Please try again.",
          }
        }

        // 2. Create Auth Account
        const { error: authError } = await authClient.signUp.email({
          email: value.email,
          password: value.password,
          name: `${value.firstName} ${value.lastName}`.trim(),
          callbackURL: verificationCallbackURL,
        })

        if (authError) {
          try {
            await deleteUserByEmail({ data: { email: value.email } })
          } catch (_e) {}
          return {
            form: authError.message || "An error occurred during sign up",
          }
        }

        setIsSuccess(true)
        return null
      },
    },
  })

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4 my-8">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-2xl">{m.auth_signup_success_title()}</CardTitle>
            <CardDescription>
              {m.auth_signup_success_description()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {m.auth_signup_success_content()}
            </p>
            <Link to="/signin" search={redirect ? { redirect } : undefined}>
              <Button className="w-full">{m.auth_signup_success_button()}</Button>
            </Link>
            <p className="text-xs text-muted-foreground text-center mt-2">
              {m.auth_signup_success_footer()}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4 my-8">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">{m.auth_signup_title()}</CardTitle>
          <CardDescription>{m.auth_signup_description()}</CardDescription>
        </CardHeader>
        <CardContent>
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
                  onChange: ({ value }) => (!value ? "First name is required" : undefined),
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
                      <p className="text-sm font-medium text-destructive">
                        {state.meta.errors.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              />
              <form.Field
                name="lastName"
                validators={{
                  onChange: ({ value }) => (!value ? "Last name is required" : undefined),
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
                      <p className="text-sm font-medium text-destructive">
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
                  if (!value) return "Email is required"
                  if (!/\S+@\S+\.\S+/.test(value)) return "Invalid email address"
                  return undefined
                },
                onChangeAsync: async ({ value }) => {
                  try {
                    const user = await getUserByEmail({ data: { email: value } })
                    if (user) return "An account already exists with this email"
                  } catch (_e) {}
                },
              }}
              children={({ state, handleChange, handleBlur }) => (
                <div className="space-y-2">
                  <Label htmlFor="email">{m.auth_signup_email_label()}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@gmail.com"
                    value={state.value}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={handleBlur}
                  />
                  {state.meta.errors.length > 0 && (
                    <p className="text-sm font-medium text-destructive">
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
                  if (!value) return "Password is required"
                  if (value.length < 8) return "Password must be at least 8 characters"
                  if (!/[A-Z]/.test(value))
                    return "Password must contain at least one uppercase letter"
                  if (!/[a-z]/.test(value))
                    return "Password must contain at least one lowercase letter"
                  if (!/[0-9]/.test(value)) return "Password must contain at least one number"
                  if (!/[\W_]/.test(value))
                    return "Password must contain at least one special character"
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
                    <p className="text-sm font-medium text-destructive">
                      {state.meta.errors.join(", ")}
                    </p>
                  )}
                </div>
              )}
            />
            <form.Field
              name="confirmPassword"
              validators={{
                onChange: ({ value }) => (!value ? "Please confirm your password" : undefined),
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
                    <p className="text-sm font-medium text-destructive">
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
                  <p className="text-sm font-medium text-destructive">
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
          <p className="text-sm text-muted-foreground">
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
