import { useEffect, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { EditIcon, RefreshCwIcon, SaveIcon, XIcon } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn-ui/card"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import { getUserByEmail, updateUser } from "@/db-fns/web/users"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/_private/profile")({
  component: ProfilePage,
})

function ProfilePage() {
  const { data: session, isPending: isSessionLoading } = authClient.useSession()
  const [user, setUser] = useState<{
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    employer: string | null
    jobTitle: string | null
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const initialSeed = useRef(Math.random())
  const [avatarSeed, setAvatarSeed] = useState(initialSeed.current)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    employer: "",
    jobTitle: "",
  })

  useEffect(() => {
    async function fetchUser() {
      if (isSessionLoading || !session?.user?.email) return

      setIsLoading(true)
      setError(null)

      try {
        const userData = await getUserByEmail({ data: { email: session.user.email } })
        setUser(userData)
        setFormData({
          firstName: userData.firstName || "",
          lastName: userData.lastName || "",
          employer: userData.employer || "",
          jobTitle: userData.jobTitle || "",
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user data")
      } finally {
        setIsLoading(false)
      }
    }

    void fetchUser()
  }, [session?.user?.email, isSessionLoading])

  const getInitials = () => {
    const first = formData.firstName?.charAt(0) || ""
    const last = formData.lastName?.charAt(0) || ""
    return (first + last).toUpperCase() || "U"
  }

  const getAvatarUrl = () => {
    const seed = `${formData.firstName}-${formData.lastName}-${avatarSeed}`
    return `https://avatar.vercel.sh/${encodeURIComponent(seed)}?size=80`
  }

  const regenerateAvatar = () => {
    setAvatarSeed(Math.random())
  }

  const handleSave = async () => {
    if (!user) return

    setIsSaving(true)
    try {
      await updateUser({
        data: {
          id: user.id,
          firstName: formData.firstName || undefined,
          lastName: formData.lastName || undefined,
          employer: formData.employer || undefined,
          jobTitle: formData.jobTitle || undefined,
        },
      })
      setUser({
        ...user,
        firstName: formData.firstName,
        lastName: formData.lastName,
        employer: formData.employer,
        jobTitle: formData.jobTitle,
      })
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      employer: user?.employer || "",
      jobTitle: user?.jobTitle || "",
    })
    setIsEditing(false)
  }

  if (isSessionLoading || isLoading) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-2">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-red-600 mt-2">{error}</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-2">Failed to load user data</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Profile</h1>

      <Card className="max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile</CardTitle>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <EditIcon className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                  <XIcon className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  <SaveIcon className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
              <img
                src={getAvatarUrl()}
                alt="Profile Avatar"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = "none"
                  const fallback = target.nextElementSibling as HTMLDivElement
                  if (fallback) fallback.style.display = "flex"
                }}
              />
              <div
                className="w-full h-full rounded-full flex items-center justify-center text-white text-xl font-bold"
                style={{
                  display: "none",
                  background: `linear-gradient(45deg, hsl(${(avatarSeed * 360) % 360}, 70%, 50%), hsl(${((avatarSeed + 0.5) * 360) % 360}, 70%, 60%))`,
                }}
              >
                {getInitials()}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={regenerateAvatar}>
              <RefreshCwIcon className="h-4 w-4 mr-2" />
              Regenerate Avatar
            </Button>
          </div>

          {/* User Info Section */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              {isEditing ? (
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              ) : (
                <p className="text-sm text-gray-900 mt-1">{formData.firstName || "Not set"}</p>
              )}
            </div>

            <div>
              <Label htmlFor="lastName">Last Name</Label>
              {isEditing ? (
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              ) : (
                <p className="text-sm text-gray-900 mt-1">{formData.lastName || "Not set"}</p>
              )}
            </div>

            <div>
              <Label htmlFor="employer">Company</Label>
              {isEditing ? (
                <Input
                  id="employer"
                  value={formData.employer}
                  onChange={(e) => setFormData({ ...formData, employer: e.target.value })}
                />
              ) : (
                <p className="text-sm text-gray-900 mt-1">{formData.employer || "Not set"}</p>
              )}
            </div>

            <div>
              <Label htmlFor="jobTitle">Title</Label>
              {isEditing ? (
                <Input
                  id="jobTitle"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                />
              ) : (
                <p className="text-sm text-gray-900 mt-1">{formData.jobTitle || "Not set"}</p>
              )}
            </div>

            <div className="col-span-2">
              <Label>Email</Label>
              <p className="text-sm text-gray-900 mt-1">{user.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
