import { useRef, useState } from "react"
import { useForm } from "@tanstack/react-form"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { z } from "zod"

import { EditIcon, LoaderCircleIcon, SaveIcon, Trash2Icon, XIcon } from "@/components/icons"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/shadcn-ui/alert-dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn-ui/card"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { inviteOrganizationUser, upgradeIndividualToOrganization } from "@/db-fns/web/billing"
import {
  getCurrentUserOrganization,
  getCurrentUserTeamsByOrganization,
} from "@/db-fns/web/organizations"
import { createTeam, updateTeam } from "@/db-fns/web/teams"
import { getUserByAuthUserId, updateUser } from "@/db-fns/web/users"
import { m } from "@/integrations/paraglide/messages.js"

type ProfileUser = Awaited<ReturnType<typeof getUserByAuthUserId>>
type ProfileOrganization = Awaited<ReturnType<typeof getCurrentUserOrganization>>
type ProfileTeams = Awaited<ReturnType<typeof getCurrentUserTeamsByOrganization>>

type ProfileFormValues = {
  displayName: string
  firstName: string
  lastName: string
  employer: string
  jobTitle: string
  avatarUrl: string
}

const ProfileFormSchema = z.object({
  displayName: z.string().trim().max(120, "Display name must be 120 characters or fewer"),
  firstName: z.string().trim().max(120, "First name must be 120 characters or fewer"),
  lastName: z.string().trim().max(120, "Last name must be 120 characters or fewer"),
  employer: z.string().trim().max(160, "Company must be 160 characters or fewer"),
  jobTitle: z.string().trim().max(160, "Title must be 160 characters or fewer"),
  avatarUrl: z
    .string()
    .trim()
    .max(2048, "Avatar URL is too long")
    .refine((value) => value.length === 0 || URL.canParse(value), "Avatar URL must be a valid URL"),
})

const EMPTY_PROFILE_FORM_VALUES: ProfileFormValues = {
  displayName: "",
  firstName: "",
  lastName: "",
  employer: "",
  jobTitle: "",
  avatarUrl: "",
}

const toFormValues = (user: ProfileUser): ProfileFormValues => ({
  displayName: user.displayName ?? "",
  firstName: user.firstName ?? "",
  lastName: user.lastName ?? "",
  employer: user.employer ?? "",
  jobTitle: user.jobTitle ?? "",
  avatarUrl: user.avatarUrl ?? "",
})

const toNullable = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const getEmailPrefix = (email: string) => {
  const prefix = email.split("@")[0] ?? ""
  return prefix.trim()
}

const getLegacyName = (user: ProfileUser) => {
  if (user.displayName?.trim()) return user.displayName.trim()
  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
  if (fullName) return fullName
  const emailPrefix = getEmailPrefix(user.email)
  if (emailPrefix) return emailPrefix
  return "User"
}

const getInitials = (label: string) => {
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "U"
  if (words.length === 1) return words[0]?.charAt(0).toUpperCase() || "U"
  return `${words[0]?.charAt(0) ?? ""}${words[1]?.charAt(0) ?? ""}`.toUpperCase()
}

const getProfileInitials = (user: ProfileUser, displayName: string) => {
  const firstInitial = user.firstName?.trim().charAt(0) ?? ""
  const lastInitial = user.lastName?.trim().charAt(0) ?? ""
  const fullNameInitials = `${firstInitial}${lastInitial}`.toUpperCase()

  if (fullNameInitials) return fullNameInitials
  return getInitials(displayName)
}

const getGeneratedAvatarUrl = (seed: string) =>
  `https://avatar.vercel.sh/${encodeURIComponent(seed)}?size=192`

const toUserLoadErrorMessage = (error: unknown) => {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "")
  const message = rawMessage.toLowerCase()

  if (message.includes("failed query")) {
    return m.profile_msg_load_server_error()
  }

  if (message.includes("user not found")) {
    return m.profile_msg_load_not_found()
  }

  return m.profile_msg_load_fallback()
}

const toUserSaveErrorMessage = (error: unknown) => {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "")
  const message = rawMessage.toLowerCase()

  if (message.includes("failed query")) {
    return m.profile_msg_save_server_error()
  }

  if (message.includes("user not found")) {
    return m.profile_msg_save_not_found()
  }

  return m.profile_msg_save_fallback()
}

const toUserUploadErrorMessage = (error: { message?: string } | unknown) => {
  const rawMessage =
    typeof error === "object" && error && "message" in error && typeof error.message === "string"
      ? error.message
      : String(error ?? "")
  const message = rawMessage.toLowerCase()

  if (message.includes("filesizemismatch") || message.includes("2mb")) {
    return m.profile_msg_upload_too_large()
  }

  if (message.includes("file count") || message.includes("maxfilecount")) {
    return m.profile_msg_upload_count()
  }

  if (message.includes("file type") || message.includes("invalid type")) {
    return m.profile_msg_upload_type()
  }

  if (message.includes("network") || message.includes("network")) {
    return m.profile_msg_upload_network()
  }

  return m.profile_msg_upload_fallback()
}

function ProfilePageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-72" />
      </div>
      <Card>
        <CardContent className="grid gap-0 p-0 lg:grid-cols-[280px_1fr]">
          <div className="space-y-6 border-b p-6 lg:border-r lg:border-b-0">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-52" />
            </div>
          </div>
          <div className="space-y-4 p-6">
            <Skeleton className="h-9 w-28" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full sm:col-span-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export const Route = createFileRoute("/_private/profile")({
  loader: async ({ context }) => {
    try {
      const authUserId = context.session?.user?.id
      if (!authUserId) {
        return {
          user: null,
          organization: null,
          teams: [],
          loadError: "No authenticated session was found.",
        }
      }
      const user = await getUserByAuthUserId({ data: { authUserId } })

      let organization: ProfileOrganization = null
      let teams: ProfileTeams = []
      organization = await getCurrentUserOrganization()
      if (organization?.id) {
        teams = await getCurrentUserTeamsByOrganization({
          data: { organizationId: organization.id },
        })
      }

      return { user, organization, teams, loadError: null as string | null }
    } catch (error) {
      const message = toUserLoadErrorMessage(error)
      return { user: null, organization: null, teams: [], loadError: message }
    }
  },
  pendingComponent: ProfilePageSkeleton,
  component: ProfilePage,
})

function ProfilePage() {
  const router = useRouter()
  const { user, loadError, organization, teams } = Route.useLoaderData()

  const profilePageKey = JSON.stringify({
    userId: user?.id ?? null,
    userAvatarUrl: user?.avatarUrl ?? null,
    organizationId: organization?.id ?? null,
    teamIds: teams.map((team: ProfileTeams[number]) => team.id),
  })

  return (
    <ProfilePageContent
      key={profilePageKey}
      router={router}
      loadedUser={user}
      loadError={loadError}
      loadedOrganization={organization}
      loadedTeams={teams}
    />
  )
}

function ProfilePageContent({
  router,
  loadedUser,
  loadError,
  loadedOrganization,
  loadedTeams,
}: {
  router: ReturnType<typeof useRouter>
  loadedUser: ProfileUser | null
  loadError: string | null
  loadedOrganization: ProfileOrganization
  loadedTeams: ProfileTeams
}) {
  const [profile, setProfile] = useState<ProfileUser | null>(loadedUser)
  const [isEditing, setIsEditing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
  const [uploadFailure, setUploadFailure] = useState<string | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [organizationCreationError, setOrganizationCreationError] = useState<string | null>(null)
  const [isUpgradingAccount, setIsUpgradingAccount] = useState(false)
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [teamCreationError, setTeamCreationError] = useState<string | null>(null)
  const [newTeamName, setNewTeamName] = useState("")
  const [newTeamDescription, setNewTeamDescription] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "developer" | "analyst">("developer")
  const [inviteTeamId, setInviteTeamId] = useState("")
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [isInviting, setIsInviting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const organization = loadedOrganization
  const teams = loadedTeams

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    if (file.size > 2 * 1024 * 1024) {
      setUploadFailure(m.profile_msg_upload_too_large())
      e.target.value = ""
      return
    }

    setIsUploading(true)
    try {
      const res = await fetch("/api/avatar-upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "Content-Length": String(file.size),
          "X-Filename": encodeURIComponent(file.name),
        },
        body: file,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({ detail: "Upload failed" }))) as {
          detail?: string
        }
        setUploadFailure(toUserUploadErrorMessage({ message: body.detail }))
        return
      }

      const { avatarUrl } = (await res.json()) as { avatarUrl: string }
      form.setFieldValue("avatarUrl", avatarUrl)
      setProfile({ ...profile, avatarUrl })
      setAvatarLoadFailed(false)
      setUploadFailure(null)
      setIsUploadModalOpen(false)
    } catch (err) {
      setUploadFailure(toUserUploadErrorMessage(err))
    } finally {
      setIsUploading(false)
      e.target.value = ""
    }
  }

  const form = useForm({
    defaultValues: profile ? toFormValues(profile) : EMPTY_PROFILE_FORM_VALUES,
    validators: {
      onSubmit: ({ value }) => {
        const result = ProfileFormSchema.safeParse(value)
        if (result.success) return undefined
        const flat = result.error.flatten()
        return {
          form: flat.formErrors[0] ?? "Please review the form values.",
          fields: {
            displayName: flat.fieldErrors.displayName?.[0],
            firstName: flat.fieldErrors.firstName?.[0],
            lastName: flat.fieldErrors.lastName?.[0],
            employer: flat.fieldErrors.employer?.[0],
            jobTitle: flat.fieldErrors.jobTitle?.[0],
            avatarUrl: flat.fieldErrors.avatarUrl?.[0],
          },
        }
      },
      onSubmitAsync: async ({ value }) => {
        if (!profile) {
          return { form: "Unable to save because the profile is unavailable." }
        }

        const validated = ProfileFormSchema.safeParse(value)
        if (!validated.success) {
          return { form: "Please fix the highlighted fields." }
        }

        try {
          await updateUser({
            data: {
              id: profile.id,
              displayName: toNullable(validated.data.displayName),
              firstName: toNullable(validated.data.firstName),
              lastName: toNullable(validated.data.lastName),
              employer: toNullable(validated.data.employer),
              jobTitle: toNullable(validated.data.jobTitle),
              avatarUrl: toNullable(validated.data.avatarUrl),
            },
          })

          setProfile({
            ...profile,
            displayName: toNullable(validated.data.displayName),
            firstName: toNullable(validated.data.firstName),
            lastName: toNullable(validated.data.lastName),
            employer: toNullable(validated.data.employer),
            jobTitle: toNullable(validated.data.jobTitle),
            avatarUrl: toNullable(validated.data.avatarUrl),
          })
          setSaveError(null)
          setIsEditing(false)
          return null
        } catch (error) {
          return {
            form: toUserSaveErrorMessage(error),
          }
        }
      },
    },
  })

  const resetProfileEditor = (nextProfile: ProfileUser) => {
    form.reset(toFormValues(nextProfile))
    setSaveError(null)
    setAvatarLoadFailed(false)
    setUploadFailure(null)
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{m.profile_title()}</h1>
          <p className="text-muted-foreground text-sm">{m.profile_error_load_description()}</p>
        </div>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">{m.profile_error_load_title()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">{loadError}</p>
            <Button onClick={() => void router.invalidate()}>{m.profile_error_load_retry()}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{m.profile_title()}</h1>
          <p className="text-muted-foreground text-sm">{m.profile_error_empty_description()}</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Button onClick={() => void router.invalidate()}>
              {m.profile_error_empty_retry()}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleCreateOrganization = async () => {
    if (!profile) return
    setOrganizationCreationError(null)
    setIsUpgradingAccount(true)
    try {
      await upgradeIndividualToOrganization()
      await router.invalidate()
    } catch (error) {
      setOrganizationCreationError(
        error instanceof Error ? error.message : "Failed to upgrade account",
      )
    } finally {
      setIsUpgradingAccount(false)
    }
  }

  const handleInviteUser = async () => {
    if (!inviteTeamId && teams.length > 0) {
      setInviteError("Choose at least one team for the invitation.")
      return
    }
    setInviteError(null)
    setInviteSuccess(null)
    setIsInviting(true)
    try {
      await inviteOrganizationUser({
        data: {
          email: inviteEmail,
          role: inviteRole,
          teamIds: [inviteTeamId || teams[0]?.id || ""].filter(Boolean),
        },
      })
      setInviteSuccess("Invitation sent.")
      setInviteEmail("")
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Failed to send invitation")
    } finally {
      setIsInviting(false)
    }
  }

  const handleCreateTeam = async () => {
    if (!organization) {
      setTeamCreationError("Create an organization before creating a team.")
      return
    }

    const trimmedName = newTeamName.trim()
    const trimmedDescription = newTeamDescription.trim()

    if (!trimmedName) {
      setTeamCreationError("Team name is required.")
      return
    }

    setIsCreatingTeam(true)
    setTeamCreationError(null)
    try {
      const data = await createTeam({
        data: {
          name: trimmedName,
          organizationId: organization.id,
        },
      })

      if (data?.id && trimmedDescription) {
        await updateTeam({
          data: {
            id: data.id,
            description: trimmedDescription,
          },
        })
      }

      setNewTeamName("")
      setNewTeamDescription("")
      await router.invalidate()
    } catch (error) {
      setTeamCreationError(error instanceof Error ? error.message : "Failed to create team")
    } finally {
      setIsCreatingTeam(false)
    }
  }

  const fallbackDisplayName = getLegacyName(profile)
  const activeDisplayName = form.state.values.displayName.trim() || fallbackDisplayName
  const activeAvatarUrl = form.state.values.avatarUrl.trim()
  const hasUploadedAvatar = activeAvatarUrl.length > 0
  const generatedSeed = `${activeDisplayName}-${profile.email}`.toLowerCase()
  const generatedAvatarUrl = getGeneratedAvatarUrl(generatedSeed)
  const avatarSrc = activeAvatarUrl || generatedAvatarUrl
  const avatarHue = generatedSeed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360
  const initials = getProfileInitials(profile, activeDisplayName)
  const canManageBilling = profile.role === "individual" || profile.role === "admin"
  const canViewProjects = true
  const canManageOrganization = profile.role === "admin"
  const canInviteUsers = profile.role === "admin" && organization && teams.length > 0

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{m.profile_title()}</h1>
        <p className="text-muted-foreground text-sm">{m.profile_description()}</p>
      </div>

      <Card className="border-border/80 overflow-hidden shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl">{m.profile_subtitle()}</CardTitle>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetProfileEditor(profile)
                  setIsEditing(true)
                }}
              >
                <EditIcon className="mr-2 h-4 w-4" />
                {m.profile_edit_button()}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetProfileEditor(profile)
                    setIsEditing(false)
                  }}
                  disabled={form.state.isSubmitting}
                >
                  <XIcon className="mr-2 h-4 w-4" />
                  {m.profile_cancel_button()}
                </Button>
                <Button
                  size="sm"
                  disabled={form.state.isSubmitting}
                  onClick={() => void form.handleSubmit()}
                >
                  {form.state.isSubmitting ? (
                    <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <SaveIcon className="mr-2 h-4 w-4" />
                  )}
                  {form.state.isSubmitting
                    ? m.profile_save_button_loading()
                    : m.profile_save_button()}
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="grid gap-0 p-0 lg:grid-cols-[300px_1fr]">
          <aside className="bg-muted/20 space-y-5 border-b p-6 lg:border-r lg:border-b-0">
            <div className="border-border/70 bg-muted relative h-24 w-24 overflow-hidden rounded-full border">
              {!avatarLoadFailed && (
                <img
                  src={avatarSrc}
                  alt="Profile avatar"
                  className="h-full w-full object-cover"
                  onError={() => setAvatarLoadFailed(true)}
                />
              )}
              {!hasUploadedAvatar && !avatarLoadFailed && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 text-2xl font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
                  {initials}
                </div>
              )}
              <div
                className={`absolute inset-0 flex items-center justify-center text-2xl font-semibold text-white ${
                  avatarLoadFailed ? "opacity-100" : "opacity-0"
                }`}
                style={{
                  background: `linear-gradient(145deg, hsl(${avatarHue} 72% 48%), hsl(${(avatarHue + 48) % 360} 78% 56%))`,
                }}
              >
                {initials}
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{activeDisplayName}</h2>
              <p className="text-muted-foreground text-sm break-all">{profile.email}</p>
              <p className="text-muted-foreground text-xs capitalize">{profile.role} account</p>
            </div>

            <div className="space-y-2">
              {canViewProjects && (
                <Button asChild variant="outline" className="w-full">
                  <Link to="/projects">Projects</Link>
                </Button>
              )}
              {canManageBilling && (
                <Button asChild variant="outline" className="w-full">
                  <Link to="/billing">Payment methods</Link>
                </Button>
              )}
            </div>

            {isEditing && (
              <div className="space-y-2">
                <AlertDialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
                  <AlertDialogTrigger asChild>
                    <Button type="button" className="w-full">
                      {m.profile_avatar_upload_button()}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{m.profile_avatar_upload_modal_title()}</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2 text-sm">
                        <span className="block">{m.profile_avatar_upload_modal_description()}</span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                      />
                      <Button
                        type="button"
                        className="w-full"
                        disabled={isUploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {isUploading && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
                        {isUploading
                          ? m.profile_save_button_loading()
                          : m.profile_avatar_upload_button()}
                      </Button>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{m.projects_docs_upload_modal_close()}</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    form.setFieldValue("avatarUrl", "")
                    setAvatarLoadFailed(false)
                  }}
                >
                  <Trash2Icon className="mr-2 h-4 w-4" />
                  {m.profile_avatar_remove_button()}
                </Button>
                {uploadFailure && <p className="text-destructive text-xs">{uploadFailure}</p>}
              </div>
            )}
          </aside>

          <form
            className="space-y-5 p-6"
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!isEditing || form.state.isSubmitting) return
              void form.handleSubmit()
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && isEditing && !form.state.isSubmitting) {
                e.preventDefault()
                resetProfileEditor(profile)
                setIsEditing(false)
              }
            }}
          >
            {(saveError || form.state.errorMap.onSubmit) && (
              <div className="border-destructive/35 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
                {saveError ??
                  (form.state.errorMap.onSubmit as { form?: string })?.form ??
                  "Could not save changes."}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field
                name="displayName"
                children={({ state, handleBlur, handleChange }) => (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="displayName">{m.profile_field_displayname_label()}</Label>
                    {isEditing ? (
                      <>
                        <Input
                          id="displayName"
                          value={state.value}
                          onBlur={handleBlur}
                          onChange={(e) => handleChange(e.target.value)}
                        />
                        {state.meta.errors[0] && (
                          <p className="text-destructive text-xs">{String(state.meta.errors[0])}</p>
                        )}
                      </>
                    ) : (
                      <p className="min-h-9 rounded-md border border-transparent px-0.5 py-2 text-sm">
                        {profile.displayName?.trim() ? (
                          profile.displayName
                        ) : (
                          <span className="text-muted-foreground italic">
                            {fallbackDisplayName}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              />

              <form.Field
                name="firstName"
                children={({ state, handleBlur, handleChange }) => (
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">{m.profile_field_firstname_label()}</Label>
                    {isEditing ? (
                      <>
                        <Input
                          id="firstName"
                          value={state.value}
                          onBlur={handleBlur}
                          onChange={(e) => handleChange(e.target.value)}
                        />
                        {state.meta.errors[0] && (
                          <p className="text-destructive text-xs">{String(state.meta.errors[0])}</p>
                        )}
                      </>
                    ) : (
                      <p className="min-h-9 rounded-md border border-transparent px-0.5 py-2 text-sm">
                        {profile.firstName || (
                          <span className="text-muted-foreground italic">Not set</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              />

              <form.Field
                name="lastName"
                children={({ state, handleBlur, handleChange }) => (
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">{m.profile_field_lastname_label()}</Label>
                    {isEditing ? (
                      <>
                        <Input
                          id="lastName"
                          value={state.value}
                          onBlur={handleBlur}
                          onChange={(e) => handleChange(e.target.value)}
                        />
                        {state.meta.errors[0] && (
                          <p className="text-destructive text-xs">{String(state.meta.errors[0])}</p>
                        )}
                      </>
                    ) : (
                      <p className="min-h-9 rounded-md border border-transparent px-0.5 py-2 text-sm">
                        {profile.lastName || (
                          <span className="text-muted-foreground italic">Not set</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              />

              <form.Field
                name="employer"
                children={({ state, handleBlur, handleChange }) => (
                  <div className="space-y-1.5">
                    <Label htmlFor="employer">{m.profile_field_company_label()}</Label>
                    {isEditing ? (
                      <>
                        <Input
                          id="employer"
                          value={state.value}
                          onBlur={handleBlur}
                          onChange={(e) => handleChange(e.target.value)}
                        />
                        {state.meta.errors[0] && (
                          <p className="text-destructive text-xs">{String(state.meta.errors[0])}</p>
                        )}
                      </>
                    ) : (
                      <p className="min-h-9 rounded-md border border-transparent px-0.5 py-2 text-sm">
                        {profile.employer || (
                          <span className="text-muted-foreground italic">Not set</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              />

              <form.Field
                name="jobTitle"
                children={({ state, handleBlur, handleChange }) => (
                  <div className="space-y-1.5">
                    <Label htmlFor="jobTitle">{m.profile_field_title_label()}</Label>
                    {isEditing ? (
                      <>
                        <Input
                          id="jobTitle"
                          value={state.value}
                          onBlur={handleBlur}
                          onChange={(e) => handleChange(e.target.value)}
                        />
                        {state.meta.errors[0] && (
                          <p className="text-destructive text-xs">{String(state.meta.errors[0])}</p>
                        )}
                      </>
                    ) : (
                      <p className="min-h-9 rounded-md border border-transparent px-0.5 py-2 text-sm">
                        {profile.jobTitle || (
                          <span className="text-muted-foreground italic">Not set</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              />

              <div className="space-y-1.5 sm:col-span-2">
                <Label>{m.profile_field_email_label()}</Label>
                <p className="border-border/60 bg-muted/25 min-h-9 rounded-md border border-dashed px-3 py-2 text-sm">
                  {profile.email}
                </p>
              </div>
            </div>

            {isEditing && (
              <p className="text-muted-foreground text-xs">{m.profile_edit_footer()}</p>
            )}
          </form>
        </CardContent>
      </Card>

      {!organization && profile.role === "individual" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upgrade to Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Upgrade your individual account to create an organization, a Default team, and move
              your projects to that team.
            </p>
            {organizationCreationError && (
              <div className="border-destructive/35 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
                {organizationCreationError}
              </div>
            )}
            <Button onClick={handleCreateOrganization} disabled={isUpgradingAccount}>
              {isUpgradingAccount && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
              Upgrade Account
            </Button>
          </CardContent>
        </Card>
      )}

      {organization && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs font-semibold">Name</Label>
                <p className="text-sm">{organization.name}</p>
              </div>
              {organization.description && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-semibold">Description</Label>
                  <p className="text-sm">{organization.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Teams</CardTitle>
            </CardHeader>
            <CardContent>
              {canManageOrganization && (
                <div className="mb-6 space-y-3 rounded-md border p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-team-name">Team name</Label>
                    <Input
                      id="new-team-name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="e.g. Operations"
                      disabled={isCreatingTeam}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-team-description">Description</Label>
                    <Textarea
                      id="new-team-description"
                      value={newTeamDescription}
                      onChange={(e) => setNewTeamDescription(e.target.value)}
                      placeholder="Optional team description"
                      disabled={isCreatingTeam}
                    />
                  </div>
                  <Button size="sm" onClick={handleCreateTeam} disabled={isCreatingTeam}>
                    {isCreatingTeam ? (
                      <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Create Team
                  </Button>
                </div>
              )}
              {teamCreationError && canManageOrganization && (
                <div className="border-destructive/35 bg-destructive/5 text-destructive mb-4 rounded-md border px-3 py-2 text-sm">
                  {teamCreationError}
                </div>
              )}
              {teams && teams.length > 0 ? (
                <div className="space-y-2">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className="border-border/60 flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{team.name}</p>
                        {team.description && (
                          <p className="text-muted-foreground text-xs">{team.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No teams yet. Create one to get started.
                </p>
              )}
            </CardContent>
          </Card>

          {canInviteUsers && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Invite User</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {inviteError && (
                  <div className="border-destructive/35 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
                    {inviteError}
                  </div>
                )}
                {inviteSuccess && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {inviteSuccess}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-role">Role</Label>
                    <select
                      id="invite-role"
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      value={inviteRole}
                      onChange={(e) =>
                        setInviteRole(e.target.value as "admin" | "developer" | "analyst")
                      }
                    >
                      <option value="admin">Admin</option>
                      <option value="developer">Developer</option>
                      <option value="analyst">Analyst</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-team">Team</Label>
                  <select
                    id="invite-team"
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                    value={inviteTeamId || teams[0]?.id || ""}
                    onChange={(e) => setInviteTeamId(e.target.value)}
                  >
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={handleInviteUser} disabled={isInviting || !inviteEmail.trim()}>
                  {isInviting && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
                  Send Invitation
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
