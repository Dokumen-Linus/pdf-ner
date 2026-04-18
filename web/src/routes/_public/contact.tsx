import { useState } from "react"
import { useForm } from "@tanstack/react-form"
import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { Button } from "@/components/shadcn-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn-ui/card"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import { Textarea } from "@/components/shadcn-ui/textarea"

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.email("Enter a valid email").max(320),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(5000),
})

type ContactInput = z.infer<typeof contactSchema>

export const submitContactForm = createServerFn({ method: "POST" })
  .inputValidator((data: ContactInput) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    const { env } = await import("@/env.server")
    const { sendEmail } = await import("@/lib/send-email")

    await sendEmail({
      to: data.email,
      template: "contact-auto-reply",
      props: { name: data.name },
    })

    await sendEmail({
      to: env.MY_EMAIL,
      template: "contact-notification",
      props: { name: data.name, email: data.email, message: data.message },
      replyTo: data.email,
    })

    return { ok: true as const }
  })

export const Route = createFileRoute("/_public/contact")({
  component: ContactPage,
})

function ContactPage() {
  const [submitted, setSubmitted] = useState(false)

  const form = useForm({
    defaultValues: { name: "", email: "", message: "" },
    validators: {
      onSubmitAsync: async ({ value }) => {
        try {
          await submitContactForm({ data: value })
          setSubmitted(true)
          return null
        } catch (error) {
          return {
            form: error instanceof Error ? error.message : "Failed to send message",
          }
        }
      },
    },
  })

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Contact</CardTitle>
          <CardDescription>Send a message and I&apos;ll get back to you shortly.</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-2">
              <p className="text-base font-medium">Thanks — check your inbox.</p>
              <p className="text-sm text-muted-foreground">
                A confirmation has been sent to your email. I&apos;ll be in touch soon.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void form.handleSubmit()
              }}
              className="space-y-4"
            >
              <form.Field
                name="name"
                validators={{
                  onChange: ({ value }) => (!value?.trim() ? "Name is required" : undefined),
                }}
                children={({ state, handleChange, handleBlur }) => (
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
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
                name="email"
                validators={{
                  onChange: ({ value }) => {
                    if (!value) return "Email is required"
                    return z.email().safeParse(value).success ? undefined : "Enter a valid email"
                  },
                }}
                children={({ state, handleChange, handleBlur }) => (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
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
                name="message"
                validators={{
                  onChange: ({ value }) => {
                    if (!value?.trim()) return "Message is required"
                    if (value.trim().length < 10) return "Message must be at least 10 characters"
                    return undefined
                  },
                }}
                children={({ state, handleChange, handleBlur }) => (
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      rows={6}
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
                {form.state.isSubmitting ? "Sending…" : "Send message"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
