import { getRequestHeaders } from "@tanstack/react-start/server"
import { createUploadthing, UploadThingError } from "uploadthing/server"
import type { FileRouter } from "uploadthing/server"
import { updateUserByAuthUserId } from "@/db-fns/web/users"
import { auth } from "@/lib/auth"

const f = createUploadthing()

export const uploadRouter = {
  avatarUploader: f(
    {
      image: {
        maxFileSize: "2MB",
        maxFileCount: 1,
      },
    },
    {
      awaitServerData: false,
    },
  )
    .middleware(async () => {
      const headers = getRequestHeaders()
      const session = await auth.api.getSession({ headers })
      const user = session?.user

      if (!user) {
        throw new UploadThingError("Unauthorized")
      }

      return { userId: user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await updateUserByAuthUserId({
        data: {
          authUserId: metadata.userId,
          avatarUrl: file.ufsUrl,
        },
      })

      return {
        uploadedBy: metadata.userId,
        fileUrl: file.ufsUrl,
      }
    }),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter
