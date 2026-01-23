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
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/_auth/signin")({
  component: SignInPage,
})

function SignInPage() {
  const navigate = useNavigate()
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
            form: error.message || "An error occurred during sign in",
          }
        }

        await navigate({ to: "/" })
        return null
      },
    },
  })

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>Enter your email and password to access your account</CardDescription>
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
            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => (!value ? "Email is required" : undefined),
              }}
              children={({ state, handleChange, handleBlur }) => (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
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
                onChange: ({ value }) => (!value ? "Password is required" : undefined),
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

            <form.Subscribe
              selector={(state) => [state.errorMap]}
              children={([errorMap]) =>
                errorMap.onSubmit ? (
                  <p className="text-sm font-medium text-destructive">
                    {errorMap.onSubmit.toString()}
                  </p>
                ) : null
              }
            />

            <Button type="submit" className="w-full" disabled={form.state.isSubmitting}>
              {form.state.isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
