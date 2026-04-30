import { useMemo, useRef, useState } from "react"
import { type ReactFormExtendedApi, useForm } from "@tanstack/react-form"
import { createFileRoute, Link, useBlocker, useRouter } from "@tanstack/react-router"
import { LoaderCircleIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react"

import { ProjectTabs } from "@/components/project-tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import { Button } from "@/components/shadcn-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn-ui/card"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn-ui/select"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { getAllStdEntityTypes } from "@/db-fns/public/std-entity-types"
import {
  createEntityType,
  deleteEntityType,
  getEntityTypesByProjectId,
  updateEntityType,
} from "@/db-fns/web/entity-types"
import { getCurrentProjectAccess, getProjectById, updateProject } from "@/db-fns/web/projects"

import type { FoundDbEntityType, FoundStandardEntityType } from "@/db/types"

const DATATYPES = ["int", "float", "alphanumeric", "alpha"] as const
const SUBTYPES = ["highlight", "underline", "squiggly", "strikeout"] as const
const HEX_COLOR_RE = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

type Orientation = "any" | "portrait" | "landscape"

type ProjectSettingsValues = {
  name: string
  description: string
  orientation: Orientation
}

type EntityTypeRow = {
  // id is empty-string for new rows (not yet persisted); otherwise the db id
  id: string
  name: string
  standardEntityTypeId: number | null
  userDefinition: string
  userExamples: string // stored as newline/comma-separated text in UI, split on save
  userFormatDescription: string
  datatype: string // "" | one of DATATYPES
  singleWord: boolean | null // tri-state
  exactLength: string // "" or integer string
  unique: boolean
  required: boolean
  subtype: string // "" | one of SUBTYPES
  color: string // "" or hex string
  opacity: string // "" or float string 0..1
}

type FormValues = { rows: EntityTypeRow[] }

function toRow(et: FoundDbEntityType): EntityTypeRow {
  return {
    id: et.id,
    name: et.name,
    standardEntityTypeId: et.standardEntityTypeId ?? null,
    userDefinition: et.userDefinition ?? "",
    userExamples: (et.userExamples ?? []).join("\n"),
    userFormatDescription: et.userFormatDescription ?? "",
    datatype: et.datatype ?? "",
    singleWord: et.singleWord,
    exactLength: et.exactLength == null ? "" : String(et.exactLength),
    unique: et.unique,
    required: et.required,
    subtype: et.subtype ?? "",
    color: et.color ?? "",
    opacity: et.opacity == null ? "" : String(et.opacity),
  }
}

function emptyRow(): EntityTypeRow {
  return {
    id: "",
    name: "",
    standardEntityTypeId: null,
    userDefinition: "",
    userExamples: "",
    userFormatDescription: "",
    datatype: "",
    singleWord: null,
    exactLength: "",
    unique: false,
    required: false,
    subtype: "",
    color: "",
    opacity: "",
  }
}

function rowFromStd(std: FoundStandardEntityType): EntityTypeRow {
  return {
    id: "",
    name: std.shortName,
    standardEntityTypeId: std.id,
    userDefinition: std.definition ?? "",
    userExamples: (std.examples ?? []).join("\n"),
    userFormatDescription: std.formatDescription ?? "",
    datatype: std.datatype ?? "",
    singleWord: std.singleWord,
    exactLength: std.exactLength == null ? "" : String(std.exactLength),
    unique: false,
    required: false,
    subtype: "",
    color: "",
    opacity: "",
  }
}

type RowValidation = { ok: true } | { ok: false; message: string; field?: string }

function validateRow(row: EntityTypeRow, index: number): RowValidation {
  if (!row.name.trim())
    return { ok: false, message: `Row ${index + 1}: name is required.`, field: "name" }
  if (row.datatype && !DATATYPES.includes(row.datatype as (typeof DATATYPES)[number]))
    return { ok: false, message: `Row ${index + 1}: invalid datatype.`, field: "datatype" }
  if (row.subtype && !SUBTYPES.includes(row.subtype as (typeof SUBTYPES)[number]))
    return { ok: false, message: `Row ${index + 1}: invalid subtype.`, field: "subtype" }
  if (row.color && !HEX_COLOR_RE.test(row.color))
    return {
      ok: false,
      message: `Row ${index + 1}: color must be a hex code (e.g. #aabbcc).`,
      field: "color",
    }
  if (row.opacity !== "") {
    const n = Number(row.opacity)
    if (Number.isNaN(n) || n < 0 || n > 1)
      return {
        ok: false,
        message: `Row ${index + 1}: opacity must be between 0 and 1.`,
        field: "opacity",
      }
  }
  if (row.exactLength !== "") {
    const n = Number(row.exactLength)
    if (!Number.isInteger(n) || n < 0)
      return {
        ok: false,
        message: `Row ${index + 1}: exact length must be a non-negative integer.`,
        field: "exactLength",
      }
  }
  return { ok: true }
}

// Convert UI row -> create/update payload (excluding id).
function rowToPayload(row: EntityTypeRow, projectId: string) {
  const examples = row.userExamples
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return {
    projectId,
    name: row.name.trim(),
    standardEntityTypeId: row.standardEntityTypeId ?? undefined,
    userDefinition: row.userDefinition.trim() || undefined,
    userExamples: examples.length > 0 ? examples : undefined,
    userFormatDescription: row.userFormatDescription.trim() || undefined,
    datatype: row.datatype || undefined,
    singleWord: row.singleWord ?? undefined,
    exactLength: row.exactLength === "" ? undefined : Number(row.exactLength),
    unique: row.unique,
    required: row.required,
    subtype: row.subtype || undefined,
    color: row.color || undefined,
    opacity: row.opacity === "" ? undefined : Number(row.opacity),
  }
}

function isOrientation(v: string | null | undefined): v is Orientation {
  return v === "any" || v === "portrait" || v === "landscape"
}

function EntityTypesSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

export const Route = createFileRoute("/_private/projects/$projectId_/entity_types")({
  loader: async ({ params, context }) => {
    try {
      const userId = context.session?.user?.id
      if (!userId) {
        return {
          project: null,
          entityTypes: [] as FoundDbEntityType[],
          stdEntityTypes: [] as FoundStandardEntityType[],
          loadError: "Not authenticated",
        }
      }
      const [project, access, entityTypes, stdEntityTypes] = await Promise.all([
        getProjectById({ data: { id: params.projectId } }),
        getCurrentProjectAccess({ data: { projectId: params.projectId } }),
        getEntityTypesByProjectId({ data: { projectId: params.projectId } }),
        getAllStdEntityTypes(),
      ])
      if (access.accountRole === "analyst" || !access.canManage) {
        return {
          project: null,
          entityTypes: [] as FoundDbEntityType[],
          stdEntityTypes: [] as FoundStandardEntityType[],
          loadError: "Only developers can manage entity types for this project.",
        }
      }
      return { project, entityTypes, stdEntityTypes, loadError: null as string | null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        project: null,
        entityTypes: [] as FoundDbEntityType[],
        stdEntityTypes: [] as FoundStandardEntityType[],
        loadError: message,
      }
    }
  },
  pendingComponent: EntityTypesSkeleton,
  component: EntityTypesPage,
})

function EntityTypesPage() {
  const router = useRouter()
  const { project, entityTypes, stdEntityTypes, loadError } = Route.useLoaderData()
  const { projectId } = Route.useParams()

  const pageKey = JSON.stringify({
    projectId,
    projectName: project?.name ?? null,
    projectDescription: project?.description ?? null,
    projectOrientation: project?.orientation ?? null,
    entityTypeIds: entityTypes.map((entityType) => entityType.id),
  })

  return (
    <EntityTypesPageContent
      key={pageKey}
      router={router}
      project={project}
      entityTypes={entityTypes}
      stdEntityTypes={stdEntityTypes}
      loadError={loadError}
      projectId={projectId}
    />
  )
}

function EntityTypesPageContent({
  router,
  project,
  entityTypes,
  stdEntityTypes,
  loadError,
  projectId,
}: {
  router: ReturnType<typeof useRouter>
  project: Awaited<ReturnType<typeof getProjectById>> | null
  entityTypes: FoundDbEntityType[]
  stdEntityTypes: FoundStandardEntityType[]
  loadError: string | null
  projectId: string
}) {
  const initialRows = useMemo(() => entityTypes.map(toRow), [entityTypes])
  const initialIds = useMemo(
    () => new Set(entityTypes.map((et: FoundDbEntityType) => et.id)),
    [entityTypes],
  )

  // Row field refs for focusing the first invalid field on submit.
  const nameInputRefs = useRef<Map<number, HTMLInputElement | null>>(new Map())

  // Project settings form state
  const initialProject: ProjectSettingsValues = useMemo(
    () => ({
      name: project?.name ?? "",
      description: project?.description ?? "",
      orientation: isOrientation(project?.orientation)
        ? (project!.orientation as Orientation)
        : "any",
    }),
    [project],
  )
  const [projectSaveError, setProjectSaveError] = useState<string | null>(null)
  const [lastSavedProject, setLastSavedProject] = useState<ProjectSettingsValues>(initialProject)
  const projectNameRef = useRef<HTMLInputElement | null>(null)

  const projectForm = useForm({
    defaultValues: initialProject,
    onSubmit: async ({ value }) => {
      setProjectSaveError(null)

      const name = value.name.trim()
      if (!name) {
        setProjectSaveError("Project name is required.")
        projectNameRef.current?.focus()
        throw new Error("Project name is required.")
      }
      if (!isOrientation(value.orientation)) {
        setProjectSaveError("Invalid orientation.")
        throw new Error("Invalid orientation.")
      }

      try {
        await updateProject({
          data: {
            id: projectId,
            name,
            description: value.description.trim() || undefined,
            orientation: value.orientation,
          },
        })
        const saved: ProjectSettingsValues = {
          name,
          description: value.description,
          orientation: value.orientation,
        }
        setLastSavedProject(saved)
        projectForm.reset(saved)
        await router.invalidate()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setProjectSaveError(message)
        throw err
      }
    },
  })

  const isProjectDirty = useMemo(() => {
    const current = projectForm.state.values
    return (
      current.name !== lastSavedProject.name ||
      current.description !== lastSavedProject.description ||
      current.orientation !== lastSavedProject.orientation
    )
  }, [projectForm.state.values, lastSavedProject])

  // Entity types form state
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedRows, setLastSavedRows] = useState<EntityTypeRow[]>(initialRows)

  const form = useForm<
    FormValues,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined
  >({
    defaultValues: { rows: initialRows } as FormValues,
    onSubmit: async ({ value }) => {
      setSaveError(null)

      for (let i = 0; i < value.rows.length; i++) {
        const v = validateRow(value.rows[i]!, i)
        if (!v.ok) {
          setSaveError(v.message)
          if (v.field === "name") {
            nameInputRefs.current.get(i)?.focus()
          }
          throw new Error(v.message)
        }
      }

      const currentIds = new Set(
        value.rows.map((r) => r.id).filter((id): id is string => Boolean(id)),
      )
      const deletedIds = [...initialIds].filter((id) => !currentIds.has(id))

      try {
        // deletes
        await Promise.all(deletedIds.map((id) => deleteEntityType({ data: { id } })))
        // creates + updates
        const results = await Promise.all(
          value.rows.map(async (row) => {
            const payload = rowToPayload(row, projectId)
            if (row.id) {
              await updateEntityType({ data: { id: row.id, ...payload } })
              return { ...row }
            }
            const { id } = await createEntityType({ data: payload })
            return { ...row, id }
          }),
        )
        setLastSavedRows(results)
        form.reset({ rows: results })
        await router.invalidate()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setSaveError(message)
        throw err
      }
    },
  })

  // dirty check: compare current values to last saved snapshot
  const isEntitiesDirty = useMemo(() => {
    const current = form.state.values.rows
    if (current.length !== lastSavedRows.length) return true
    return JSON.stringify(current) !== JSON.stringify(lastSavedRows)
  }, [form.state.values.rows, lastSavedRows])

  const isAnyDirty = isProjectDirty || isEntitiesDirty
  const isAnySubmitting = projectForm.state.isSubmitting || form.state.isSubmitting

  // warn before navigating away with unsaved changes in either form
  const blocker = useBlocker({
    shouldBlockFn: () => isAnyDirty && !isAnySubmitting,
    withResolver: true,
    enableBeforeUnload: () => isAnyDirty,
  })

  if (loadError || !project) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-pretty">Entity Types</h1>
        </div>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load entity types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {loadError || "Project not found."}
            </p>
            <Button onClick={() => void router.invalidate()}>Retry</Button>
            <Button variant="outline" asChild className="ml-2">
              <Link to="/projects">Back to Projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-pretty" translate="no">
          {project.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Define project settings and the entity types this project will extract and annotate.
        </p>
      </div>

      <ProjectTabs projectId={projectId} currentStep="entity_types" />

      {/* ------ Form A: Project Settings ------ */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void projectForm.handleSubmit()
        }}
        className="space-y-4"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Settings</CardTitle>
            <CardDescription>
              Edit the project name, description, and default page orientation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {projectSaveError && (
              <div
                role="alert"
                aria-live="polite"
                className="border-destructive/35 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
              >
                {projectSaveError}
              </div>
            )}

            <projectForm.Field name="name">
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="project-name">Name</Label>
                  <Input
                    id="project-name"
                    name="project-name"
                    autoComplete="off"
                    ref={(el) => {
                      projectNameRef.current = el
                    }}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="e.g. Invoice Extraction…"
                  />
                </div>
              )}
            </projectForm.Field>

            <projectForm.Field name="description">
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="project-description">Description</Label>
                  <Textarea
                    id="project-description"
                    name="project-description"
                    autoComplete="off"
                    rows={2}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Short summary shown throughout the app…"
                  />
                </div>
              )}
            </projectForm.Field>

            <projectForm.Field name="orientation">
              {(field) => (
                <div className="space-y-1.5">
                  <Label>Page Orientation</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => {
                      if (isOrientation(v)) field.handleChange(v)
                    }}
                  >
                    <SelectTrigger className="w-60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    Default orientation hint for uploaded documents.
                  </p>
                </div>
              )}
            </projectForm.Field>

            <div className="flex items-center justify-between pt-2">
              <p className="text-muted-foreground text-xs" aria-live="polite">
                {isProjectDirty ? "You have unsaved changes." : "All changes saved."}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isProjectDirty || projectForm.state.isSubmitting}
                  onClick={() => {
                    projectForm.reset(lastSavedProject)
                    setProjectSaveError(null)
                  }}
                >
                  Discard Changes
                </Button>
                <Button type="submit" disabled={!isProjectDirty || projectForm.state.isSubmitting}>
                  {projectForm.state.isSubmitting ? (
                    <>
                      <LoaderCircleIcon aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <SaveIcon aria-hidden="true" className="mr-2 h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* ------ Form B: Entity Types ------ */}
      <div className="space-y-1 pt-2">
        <h2 className="text-xl font-semibold tracking-tight">Entity Types</h2>
        <p className="text-muted-foreground text-sm">
          Pick a standard entity as a starting point or create a custom one.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void form.handleSubmit()
        }}
        className="space-y-4"
      >
        {saveError && (
          <div
            role="alert"
            aria-live="polite"
            className="border-destructive/35 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            {saveError}
          </div>
        )}

        <form.Field name="rows" mode="array">
          {(rowsField) => (
            <>
              <div className="space-y-4">
                {rowsField.state.value.map((row, index) => (
                  <EntityTypeRowCard
                    key={row.id || `new-${index}`}
                    index={index}
                    projectId={projectId}
                    stdEntityTypes={stdEntityTypes}
                    onRemove={() => {
                      nameInputRefs.current.delete(index)
                      rowsField.removeValue(index)
                    }}
                    form={form}
                    registerNameRef={(el) => {
                      if (el) nameInputRefs.current.set(index, el)
                      else nameInputRefs.current.delete(index)
                    }}
                  />
                ))}
              </div>

              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Add entity type"
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => rowsField.pushValue(emptyRow())}
                >
                  <PlusIcon aria-hidden="true" className="mr-2 h-4 w-4" />
                  Add Custom Entity Type
                </Button>
                <AddFromStandard
                  stdEntityTypes={stdEntityTypes}
                  existingStdIds={
                    new Set(
                      rowsField.state.value
                        .map((r) => r.standardEntityTypeId)
                        .filter((v): v is number => v != null),
                    )
                  }
                  onSelect={(std) => rowsField.pushValue(rowFromStd(std))}
                />
              </div>
            </>
          )}
        </form.Field>

        <div className="bg-background/95 sticky bottom-4 flex items-center justify-between rounded-md border p-3 shadow-sm backdrop-blur">
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {isEntitiesDirty ? "You have unsaved changes." : "All changes saved."}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!isEntitiesDirty || form.state.isSubmitting}
              onClick={() => {
                form.reset({ rows: lastSavedRows })
                setSaveError(null)
              }}
            >
              Discard Changes
            </Button>
            <Button type="submit" disabled={!isEntitiesDirty || form.state.isSubmitting}>
              {form.state.isSubmitting ? (
                <>
                  <LoaderCircleIcon aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <SaveIcon aria-hidden="true" className="mr-2 h-4 w-4" />
                  Save Entity Types
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      <AlertDialog open={blocker.status === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you leave now, your edits will be discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Stay on Page</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>
              Discard &amp; Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AddFromStandard({
  stdEntityTypes,
  existingStdIds,
  onSelect,
}: {
  stdEntityTypes: FoundStandardEntityType[]
  existingStdIds: Set<number>
  onSelect: (std: FoundStandardEntityType) => void
}) {
  return (
    <Select
      value=""
      onValueChange={(value) => {
        const std = stdEntityTypes.find((s) => String(s.id) === value)
        if (std) onSelect(std)
      }}
    >
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Add from standard entity types…" />
      </SelectTrigger>
      <SelectContent>
        {stdEntityTypes.length === 0 ? (
          <div className="text-muted-foreground px-2 py-1.5 text-sm">
            No standard entity types available.
          </div>
        ) : (
          stdEntityTypes.map((std) => (
            <SelectItem key={std.id} value={String(std.id)} disabled={existingStdIds.has(std.id)}>
              {std.shortName}
              {std.longName ? ` — ${std.longName}` : ""}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}

function EntityTypeRowCard({
  index,
  projectId: _projectId,
  stdEntityTypes,
  onRemove,
  form,
  registerNameRef,
}: {
  index: number
  projectId: string
  stdEntityTypes: FoundStandardEntityType[]
  onRemove: () => void
  form: ReactFormExtendedApi<
    FormValues,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined
  >
  registerNameRef: (el: HTMLInputElement | null) => void
}) {
  const stdLabel = (id: number | null) => {
    if (id == null) return null
    const std = stdEntityTypes.find((s) => s.id === id)
    return std ? std.shortName : null
  }

  const headingId = `entity-type-heading-${index}`

  return (
    <Card aria-labelledby={headingId}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle id={headingId} className="text-base">
            Entity Type #{index + 1}
            {form.state.values.rows[index]?.standardEntityTypeId != null && (
              <span className="text-muted-foreground ml-2 text-xs font-normal">
                (standard: {stdLabel(form.state.values.rows[index]!.standardEntityTypeId)})
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Configure how this entity is identified and rendered in the PDF.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Remove entity type ${index + 1}`}
          onClick={onRemove}
        >
          <Trash2Icon aria-hidden="true" className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {/* name */}
        <form.Field name={`rows[${index}].name`}>
          {(field) => (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`name-${index}`}>Name</Label>
              <Input
                id={`name-${index}`}
                name={`name-${index}`}
                autoComplete="off"
                spellCheck={false}
                ref={registerNameRef}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g. Invoice Number…"
              />
              <p className="text-muted-foreground text-xs">
                Short label shown in the UI and used to tag spans in the PDF.
              </p>
            </div>
          )}
        </form.Field>

        {/* userDefinition */}
        <form.Field name={`rows[${index}].userDefinition`}>
          {(field) => (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`def-${index}`}>Definition</Label>
              <Textarea
                id={`def-${index}`}
                name={`def-${index}`}
                autoComplete="off"
                rows={2}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Describe, in plain language, what counts as this entity…"
              />
              <p className="text-muted-foreground text-xs">
                A precise natural-language definition. The LLM uses this to decide what to extract.
              </p>
            </div>
          )}
        </form.Field>

        {/* userExamples */}
        <form.Field name={`rows[${index}].userExamples`}>
          {(field) => (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`ex-${index}`}>Examples</Label>
              <Textarea
                id={`ex-${index}`}
                name={`ex-${index}`}
                autoComplete="off"
                spellCheck={false}
                rows={2}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder={"One example per line, e.g.\nINV-12345\nINV-0001"}
              />
              <p className="text-muted-foreground text-xs">
                One example per line. A few high-quality examples significantly improve extraction.
              </p>
            </div>
          )}
        </form.Field>

        {/* userFormatDescription */}
        <form.Field name={`rows[${index}].userFormatDescription`}>
          {(field) => (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`fmt-${index}`}>Format Description</Label>
              <Input
                id={`fmt-${index}`}
                name={`fmt-${index}`}
                autoComplete="off"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g. “INV-” followed by digits…"
              />
              <p className="text-muted-foreground text-xs">
                Optional description of the expected surface form (pattern, prefix, length, etc.).
              </p>
            </div>
          )}
        </form.Field>

        {/* datatype */}
        <form.Field name={`rows[${index}].datatype`}>
          {(field) => (
            <div className="space-y-1.5">
              <Label>Datatype</Label>
              <Select
                value={field.state.value || "__none__"}
                onValueChange={(v) => field.handleChange(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unspecified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unspecified</SelectItem>
                  {DATATYPES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Underlying data kind (int, float, alphanumeric, alpha). Constrains post-processing.
              </p>
            </div>
          )}
        </form.Field>

        {/* singleWord */}
        <form.Field name={`rows[${index}].singleWord`}>
          {(field) => (
            <div className="space-y-1.5">
              <Label>Single Word</Label>
              <Select
                value={
                  field.state.value == null ? "__none__" : field.state.value ? "true" : "false"
                }
                onValueChange={(v) => field.handleChange(v === "__none__" ? null : v === "true")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unspecified</SelectItem>
                  <SelectItem value="true">Yes — must be one word</SelectItem>
                  <SelectItem value="false">No — may span multiple words</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Whether extracted values must be a single whitespace-delimited token.
              </p>
            </div>
          )}
        </form.Field>

        {/* exactLength */}
        <form.Field name={`rows[${index}].exactLength`}>
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={`len-${index}`}>Exact Length</Label>
              <Input
                id={`len-${index}`}
                name={`len-${index}`}
                type="number"
                inputMode="numeric"
                autoComplete="off"
                min={0}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g. 10"
              />
              <p className="text-muted-foreground text-xs">
                If set, extracted values must have exactly this many characters.
              </p>
            </div>
          )}
        </form.Field>

        {/* unique */}
        <form.Field name={`rows[${index}].unique`}>
          {(field) => (
            <div className="flex items-start gap-2">
              <Checkbox
                id={`unique-${index}`}
                checked={field.state.value}
                onCheckedChange={(v) => field.handleChange(v === true)}
              />
              <div className="space-y-0.5">
                <Label htmlFor={`unique-${index}`}>Unique</Label>
                <p className="text-muted-foreground text-xs">
                  Only one instance of this entity type is expected per document.
                </p>
              </div>
            </div>
          )}
        </form.Field>

        {/* required */}
        <form.Field name={`rows[${index}].required`}>
          {(field) => (
            <div className="flex items-start gap-2">
              <Checkbox
                id={`required-${index}`}
                checked={field.state.value}
                onCheckedChange={(v) => field.handleChange(v === true)}
              />
              <div className="space-y-0.5">
                <Label htmlFor={`required-${index}`}>Required</Label>
                <p className="text-muted-foreground text-xs">
                  Every document must contain at least one instance of this entity.
                </p>
              </div>
            </div>
          )}
        </form.Field>

        {/* subtype */}
        <form.Field name={`rows[${index}].subtype`}>
          {(field) => (
            <div className="space-y-1.5">
              <Label>Annotation Style</Label>
              <Select
                value={field.state.value || "__none__"}
                onValueChange={(v) => field.handleChange(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unspecified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unspecified</SelectItem>
                  {SUBTYPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                How this entity is visualized in the PDF (highlight, underline, etc.).
              </p>
            </div>
          )}
        </form.Field>

        {/* color */}
        <form.Field name={`rows[${index}].color`}>
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={`color-${index}`}>Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`color-${index}`}
                  name={`color-${index}`}
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="#aabbcc"
                />
                {HEX_COLOR_RE.test(field.state.value) && (
                  <span
                    aria-hidden="true"
                    className="h-8 w-8 rounded border"
                    style={{ backgroundColor: field.state.value }}
                  />
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Hex color used for the annotation (e.g. #ffcc00).
              </p>
            </div>
          )}
        </form.Field>

        {/* opacity */}
        <form.Field name={`rows[${index}].opacity`}>
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={`op-${index}`}>Opacity</Label>
              <Input
                id={`op-${index}`}
                name={`op-${index}`}
                type="number"
                inputMode="decimal"
                autoComplete="off"
                step="0.05"
                min={0}
                max={1}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="0.0 – 1.0"
              />
              <p className="text-muted-foreground text-xs">
                Annotation opacity between 0 (transparent) and 1 (opaque).
              </p>
            </div>
          )}
        </form.Field>
      </CardContent>
    </Card>
  )
}
