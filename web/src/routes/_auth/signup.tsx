import { useState } from "react"
import { useForm } from "@tanstack/react-form"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
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

export const Route = createFileRoute("/_auth/signup")({
  component: SignUpPage,
})

function SignUpPage() {
  const navigate = useNavigate()
  const [isSuccess, setIsSuccess] = useState(false)
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
        } catch (_e) {
          try {
            await deleteUserByEmail({ data: { email: value.email } })
          } catch (_e) {}

          return {
            form: "Account created but failed to set up profile. Please contact support.",
          }
        }

        // 2. Create Auth Account
        const { error: authError } = await authClient.signUp.email({
          email: value.email,
          password: value.password,
          name: `${value.firstName} ${value.lastName}`.trim(),
        })

        if (authError) {
          // If auth fails, we probably should delete the user profile created above to keep data clean?
          // But maybe the user exists in auth but not in profile?
          // For now let's just return error.
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
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We've sent a verification link to your email address. Please click the link to verify
              your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Once you have verified your email, you can sign in.
            </p>
            <Link to="/signin">
              <Button className="w-full">Go to Sign In</Button>
            </Link>
            <p className="text-xs text-muted-foreground text-center mt-2">
              After verifying your email and signing in, you'll be redirected to your profile.
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
          <CardTitle className="text-2xl">Sign Up</CardTitle>
          <CardDescription>Create an account to get started</CardDescription>
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
                    <Label htmlFor="firstName">First Name</Label>
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
                    <Label htmlFor="lastName">Last Name</Label>
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
                  <Label htmlFor="employer">Employer</Label>
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
                  <Label htmlFor="jobTitle">Job Title</Label>
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
                    const user = await getUserByEmail(value as any)
                    if (user) return "An account already exists with this email"
                  } catch (_e) {}
                },
              }}
              children={({ state, handleChange, handleBlur }) => (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
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
                  <Label htmlFor="password">Password</Label>
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
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
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
              {form.state.isSubmitting ? "Creating Account..." : "Sign Up"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/signin" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
