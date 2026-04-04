import { useState } from "react"
import { useForm } from "@tanstack/react-form"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Palette, Plus, X } from "lucide-react"
import ColorPicker from "@/components/custom/color-picker"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn-ui/select"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { createProject } from "@/db-fns/web/projects"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/_private/create-project")({
  component: CreateProjectPage,
})

function CreateProjectPage() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const [colorPresets, setColorPresets] = useState<string[]>(["#3B82F6"])

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      orientation: "any" as "any" | "portrait" | "landscape",
    },
    validators: {
      onSubmitAsync: async ({ value }) => {
        if (!session?.user?.id) {
          return { form: "User not authenticated" }
        }

        try {
          await createProject({
            data: {
              name: value.name,
              ownerId: session.user.id,
              description: value.description || undefined,
              orientation: value.orientation,
              colorPresets: colorPresets.length > 0 ? colorPresets : undefined,
            },
          })

          navigate({
            to: "/profile",
          })
        } catch (error) {
          return {
            form: error instanceof Error ? error.message : "Failed to create project",
          }
        }
      },
    },
  })

  const addColorPreset = () => {
    if (colorPresets.length < 8) {
      setColorPresets([...colorPresets, "#000000"])
    }
  }

  const updateColorPreset = (index: number, color: string) => {
    const newPresets = [...colorPresets]
    newPresets[index] = color
    setColorPresets(newPresets)
  }

  const removeColorPreset = (index: number) => {
    setColorPresets(colorPresets.filter((_, i) => i !== index))
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Create New Project
          </CardTitle>
          <CardDescription>
            Set up a new project with custom colors and orientation preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
            className="space-y-6"
          >
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  if (!value.trim()) return "Project name is required"
                  if (value.length < 2) return "Project name must be at least 2 characters"
                  if (value.length > 100) return "Project name must be less than 100 characters"
                  return undefined
                },
              }}
              children={({ state, handleChange, handleBlur }) => (
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    placeholder="My PDF Analysis Project"
                    value={state.value}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={handleBlur}
                    className={state.meta.errors.length > 0 ? "border-destructive" : ""}
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
              name="description"
              validators={{
                onChange: ({ value }) => {
                  if (value && value.length > 500) {
                    return "Description must be less than 500 characters"
                  }
                  return undefined
                },
              }}
              children={({ state, handleChange, handleBlur }) => (
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your project's purpose and goals..."
                    value={state.value}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={handleBlur}
                    rows={3}
                    className={state.meta.errors.length > 0 ? "border-destructive" : ""}
                  />
                  {state.meta.errors.length > 0 && (
                    <p className="text-sm font-medium text-destructive">
                      {state.meta.errors.join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {state.value.length}/500 characters
                  </p>
                </div>
              )}
            />

            <form.Field
              name="orientation"
              children={({ state, handleChange }) => (
                <div className="space-y-2">
                  <Label>Document Orientation</Label>
                  <Select
                    value={state.value}
                    onValueChange={(value) =>
                      handleChange(value as "any" | "portrait" | "landscape")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select orientation preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Orientation</SelectItem>
                      <SelectItem value="portrait">Portrait Only</SelectItem>
                      <SelectItem value="landscape">Landscape Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This setting will be used as a default for documents in this project
                  </p>
                </div>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Color Presets</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose up to 8 colors for entity highlighting
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addColorPreset}
                  disabled={colorPresets.length >= 8}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Color
                </Button>
              </div>

              {colorPresets.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {colorPresets.map((color, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <ColorPicker
                        value={color}
                        onChange={(newColor) => updateColorPreset(index, newColor)}
                      />
                      <div className="flex-1 min-w-0">
                        <Input
                          value={color}
                          onChange={(e) => updateColorPreset(index, e.target.value)}
                          className="text-xs font-mono"
                          placeholder="#000000"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeColorPreset(index)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {colorPresets.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                  <Palette className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No color presets added. Click &quot;Add Color&quot; to get started.
                  </p>
                </div>
              )}
            </div>

            <form.Subscribe
              selector={(state) => [state.errorMap]}
              children={([errorMap]) =>
                errorMap.onSubmit ? (
                  <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <p className="text-sm font-medium text-destructive">
                      {(errorMap.onSubmit as { form?: string })?.form ?? String(errorMap.onSubmit)}
                    </p>
                  </div>
                ) : null
              }
            />

            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/profile" })}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.state.isSubmitting} className="flex-1">
                {form.state.isSubmitting ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
