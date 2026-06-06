import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db/client"
import { applications } from "@/db/schemas/web/applications"
import { createMonitoredDbFn } from "@/db-fns/web/monitoring"

// ** CREATE SCHEMA **
export const CreateApplicationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email").max(320),
  phone: z.string().trim().max(50).nullable().optional(),
  message: z.string().trim().max(5000).nullable().optional(),
})

export const createApplication = createMonitoredDbFn({ eventName: "web.application.create", method: "POST" })
  .inputValidator(CreateApplicationSchema)
  .handler(async ({ data }) => {
    try {
      const [app] = await db.insert(applications).values(data).returning({ id: applications.id })
      return { id: app.id }
    } catch (error) {
      console.error("createApplication failed", {
        email: data.email,
        error,
      })
      throw new Error("Failed to submit application")
    }
  })

// ** READ BY ID **
export const getApplicationById = createMonitoredDbFn({ eventName: "web.application.get_by_id", method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const [app] = await db.select().from(applications).where(eq(applications.id, data.id)).limit(1)
    if (!app) {
      throw new Error("Application not found")
    }
    return app
  })

// ** DELETE BY ID **
export const deleteApplication = createMonitoredDbFn({ eventName: "web.application.delete", method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const result = await db.delete(applications).where(eq(applications.id, data.id))
    if (result.rowCount === 0) {
      throw new Error("Application not found")
    }
    return { success: true }
  })
