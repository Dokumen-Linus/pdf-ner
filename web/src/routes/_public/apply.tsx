import { useRef, useState } from "react"
import { useForm } from "@tanstack/react-form"
import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  FileText,
  Mail,
  Phone,
  UploadCloud,
  User,
  X,
} from "lucide-react"
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

const applyFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email").max(320),
  phone: z.string().trim().max(50).nullable().optional(),
  message: z.string().trim().max(5000).nullable().optional(),
  resume: z.object({
    filename: z.string().min(1, "Resume PDF is required"),
    content: z.string().min(1, "Resume file content is missing"), // Base64
  }),
})

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator(applyFormSchema)
  .handler(async ({ data }) => {
    const { createApplication } = await import("@/db-fns/web/applications")
    const { sendApplicationEmail } = await import("@/lib/send-email")

    const { resume, ...personalInfo } = data

    // 1. Save candidate details to web.applications database
    await createApplication({ data: personalInfo })

    // 2. Send email notification with base64 PDF attachment
    await sendApplicationEmail({
      name: personalInfo.name,
      email: personalInfo.email,
      phone: personalInfo.phone,
      message: personalInfo.message,
      resume,
    })

    return { success: true }
  })

export const Route = createFileRoute("/_public/apply")({
  component: ApplyPage,
})

function ApplyPage() {
  const [submitted, setSubmitted] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null)
  const resumeDataRef = useRef<{ filename: string; content: string } | null>(null)

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      message: "",
    },
    validators: {
      onSubmitAsync: async ({ value }) => {
        const currentResume = resumeDataRef.current
        if (!currentResume) {
          setFileError("Please upload your resume PDF")
          return { form: "Resume PDF is required" }
        }

        try {
          const payload = {
            ...value,
            phone: value.phone || null,
            message: value.message || null,
            resume: currentResume,
          }

          await submitApplication({ data: payload })
          setSubmitted(true)
          return null
        } catch (error) {
          return {
            form: error instanceof Error ? error.message : "Failed to submit your application.",
          }
        }
      },
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== "application/pdf") {
      setFileError("Only PDF files are accepted")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError("File size must be smaller than 5MB")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const base64Content = reader.result.split(",")[1]
        resumeDataRef.current = {
          filename: file.name,
          content: base64Content,
        }
        setSelectedFile({
          name: file.name,
          size: file.size,
        })
      }
    }
    reader.readAsDataURL(file)
  }

  const removeFile = () => {
    setSelectedFile(null)
    resumeDataRef.current = null
    setFileError(null)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  return (
    <div className="from-background via-muted/30 to-background relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-gradient-to-br p-6 md:p-12">
      {/* Background glow effects */}
      <div className="bg-primary/10 absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full blur-3xl" />
      <div className="bg-primary/5 absolute right-1/4 bottom-1/4 -z-10 h-72 w-72 rounded-full blur-3xl" />

      <Card className="border-muted-foreground/15 bg-card/80 w-full max-w-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300">
        <CardHeader className="border-muted/50 space-y-2 border-b pb-8 text-center">
          <div className="bg-primary/10 text-primary mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <Briefcase className="h-6 w-6" />
          </div>
          <CardTitle className="from-foreground via-foreground/90 to-primary bg-gradient-to-r bg-clip-text text-3xl font-bold tracking-tight">
            Join Our Team
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            Complete the form below and upload your resume to apply.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          {submitted ? (
            <div className="animate-in fade-in zoom-in-95 flex flex-col items-center justify-center space-y-6 py-12 text-center duration-500">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-8 ring-emerald-500/5">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-foreground text-2xl font-bold">Application Submitted!</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Thank you for applying. We have successfully received your personal information
                  and resume. Our team will review your application and get back to you shortly.
                </p>
              </div>
              <Button
                variant="outline"
                className="mt-4 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => {
                  setSubmitted(false)
                  form.reset()
                  removeFile()
                }}
              >
                Apply for another position
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void form.handleSubmit()
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.Field
                  name="name"
                  validators={{
                    onChange: ({ value }) => (!value?.trim() ? "Name is required" : undefined),
                  }}
                  children={({ state, handleChange, handleBlur }) => (
                    <div className="space-y-2">
                      <Label
                        htmlFor="name"
                        className="flex items-center gap-1.5 text-sm font-semibold"
                      >
                        <User className="text-muted-foreground h-4 w-4" /> Full Name *
                      </Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        value={state.value}
                        onChange={(e) => handleChange(e.target.value)}
                        onBlur={handleBlur}
                        className="focus:ring-primary/20 h-11 transition-all focus:ring-2"
                      />
                      {state.meta.errors.length > 0 && (
                        <p className="text-destructive flex items-center gap-1 text-xs font-semibold">
                          <AlertCircle className="h-3 w-3" /> {state.meta.errors.join(", ")}
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
                      return z.email().safeParse(value).success
                        ? undefined
                        : "Invalid email address"
                    },
                  }}
                  children={({ state, handleChange, handleBlur }) => (
                    <div className="space-y-2">
                      <Label
                        htmlFor="email"
                        className="flex items-center gap-1.5 text-sm font-semibold"
                      >
                        <Mail className="text-muted-foreground h-4 w-4" /> Email Address *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        value={state.value}
                        onChange={(e) => handleChange(e.target.value)}
                        onBlur={handleBlur}
                        className="focus:ring-primary/20 h-11 transition-all focus:ring-2"
                      />
                      {state.meta.errors.length > 0 && (
                        <p className="text-destructive flex items-center gap-1 text-xs font-semibold">
                          <AlertCircle className="h-3 w-3" /> {state.meta.errors.join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                />
              </div>

              <form.Field
                name="phone"
                children={({ state, handleChange, handleBlur }) => (
                  <div className="space-y-2">
                    <Label
                      htmlFor="phone"
                      className="flex items-center gap-1.5 text-sm font-semibold"
                    >
                      <Phone className="text-muted-foreground h-4 w-4" /> Phone Number (Optional)
                    </Label>
                    <Input
                      id="phone"
                      placeholder="+1 (555) 123-4567"
                      value={state.value}
                      onChange={(e) => handleChange(e.target.value)}
                      onBlur={handleBlur}
                      className="focus:ring-primary/20 h-11 transition-all focus:ring-2"
                    />
                  </div>
                )}
              />

              <form.Field
                name="message"
                children={({ state, handleChange, handleBlur }) => (
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-sm font-semibold">
                      Cover Letter / Message (Optional)
                    </Label>
                    <Textarea
                      id="message"
                      rows={4}
                      placeholder="Tell us about yourself and why you're a good fit..."
                      value={state.value}
                      onChange={(e) => handleChange(e.target.value)}
                      onBlur={handleBlur}
                      className="focus:ring-primary/20 min-h-[100px] resize-y transition-all focus:ring-2"
                    />
                  </div>
                )}
              />

              {/* PDF Resume Upload Dropzone */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-semibold">
                  <FileText className="text-muted-foreground h-4 w-4" /> Resume PDF *
                </Label>

                {!selectedFile ? (
                  <div className="group border-muted-foreground/25 hover:border-primary/50 bg-muted/10 hover:bg-muted/20 relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all duration-300">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                    />
                    <UploadCloud className="text-muted-foreground group-hover:text-primary mb-2 h-10 w-10 transition-colors duration-300" />
                    <p className="text-foreground mb-1 text-sm font-semibold">
                      Click to upload or drag & drop
                    </p>
                    <p className="text-muted-foreground text-xs">PDF only (Max 5MB)</p>
                  </div>
                ) : (
                  <div className="border-primary/20 bg-primary/5 animate-in fade-in flex items-center justify-between rounded-xl border p-4 duration-300">
                    <div className="flex items-center space-x-3">
                      <div className="bg-primary/10 text-primary rounded-lg p-2.5">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-foreground max-w-[280px] truncate text-sm font-semibold md:max-w-[400px]">
                          {selectedFile.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatBytes(selectedFile.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={removeFile}
                      className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground h-9 w-9 rounded-full transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                )}

                {fileError && (
                  <p className="text-destructive animate-in slide-in-from-top-1 mt-1 flex items-center gap-1 text-xs font-semibold duration-200">
                    <AlertCircle className="h-3 w-3" /> {fileError}
                  </p>
                )}
              </div>

              {/* Form level error display */}
              <form.Subscribe
                selector={(state) => [state.errorMap]}
                children={([errorMap]) =>
                  errorMap.onSubmit ? (
                    <div className="border-destructive/20 bg-destructive/5 text-destructive animate-in fade-in flex items-start space-x-2.5 rounded-lg border p-3 text-sm font-semibold duration-200">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        {(errorMap.onSubmit as { form?: string })?.form ??
                          String(errorMap.onSubmit)}
                      </div>
                    </div>
                  ) : null
                }
              />

              <Button
                type="submit"
                className="hover:shadow-primary/25 h-11 w-full text-base font-semibold shadow-lg transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                disabled={form.state.isSubmitting}
              >
                {form.state.isSubmitting ? "Submitting Application..." : "Submit Application"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
