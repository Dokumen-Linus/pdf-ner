import { createFileRoute } from "@tanstack/react-router"
import { createRouteHandler } from "uploadthing/server"
import { uploadRouter } from "@/integrations/uploadthing/upload-router"

const uploadthingHandler = createRouteHandler({
  router: uploadRouter,
})

export const Route = createFileRoute("/api/uploadthing")({
  server: {
    handlers: {
      GET: async ({ request }) => uploadthingHandler(request),
      POST: async ({ request }) => uploadthingHandler(request),
    },
  },
})
