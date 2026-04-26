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
import { m } from "@/integrations/paraglide/messages.js"

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.email("Enter a valid email").max(320),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(5000),
})

export const submitContactForm = createServerFn({ method: "POST" })
  .inputValidator(contactSchema)
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
            form: error instanceof Error ? error.message : m.contact_error_send_failed(),
          }
        }
      },
    },
  })

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">{m.contact_title()}</CardTitle>
          <CardDescription>{m.contact_description()}</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-2">
              <p className="text-base font-medium">{m.contact_success_title()}</p>
              <p className="text-muted-foreground text-sm">{m.contact_success_description()}</p>
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
                  onChange: ({ value }) => (!value?.trim() ? m.contact_name_required() : undefined),
                }}
                children={({ state, handleChange, handleBlur }) => (
                  <div className="space-y-2">
                    <Label htmlFor="name">{m.contact_name_label()}</Label>
                    <Input
                      id="name"
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
                name="email"
                validators={{
                  onChange: ({ value }) => {
                    if (!value) return m.contact_email_required()
                    return z.email().safeParse(value).success
                      ? undefined
                      : m.contact_email_invalid()
                  },
                }}
                children={({ state, handleChange, handleBlur }) => (
                  <div className="space-y-2">
                    <Label htmlFor="email">{m.contact_email_label()}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={m.contact_email_placeholder()}
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
                name="message"
                validators={{
                  onChange: ({ value }) => {
                    if (!value?.trim()) return m.contact_message_required()
                    if (value.trim().length < 10) return m.contact_message_min()
                    return undefined
                  },
                }}
                children={({ state, handleChange, handleBlur }) => (
                  <div className="space-y-2">
                    <Label htmlFor="message">{m.contact_message_label()}</Label>
                    <Textarea
                      id="message"
                      rows={6}
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
                {form.state.isSubmitting
                  ? m.contact_submit_button_loading()
                  : m.contact_submit_button()}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
