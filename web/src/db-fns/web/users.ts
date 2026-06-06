import { eq } from "drizzle-orm/sql"
import { z } from "zod"

import { db } from "@/db/client"
import { users } from "@/db/schemas/web/users"
import { createMonitoredDbFn } from "@/db-fns/web/monitoring"

// ** CREATE **
export const CreateUserSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullable().optional(),
  email: z.email(),
  displayName: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  employer: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
})

export const createUser = createMonitoredDbFn({ eventName: "web.user.create", method: "POST" })
  .inputValidator(CreateUserSchema)
  .handler(async ({ data }) => {
    try {
      const [user] = await db.insert(users).values(data).returning({ id: users.id })
      return { id: user.id }
    } catch (error) {
      console.error("createUser failed", {
        email: data.email,
        error,
      })
      throw new Error("Failed to create user profile")
    }
  })

// ** READ **
export const getUserById = createMonitoredDbFn({ eventName: "web.user.get_by_id", method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const [user] = await db.select().from(users).where(eq(users.id, data.id)).limit(1)
    if (!user) {
      throw new Error("User not found")
    }
    return user
  })

export const getUserByEmail = createMonitoredDbFn({ eventName: "web.user.get_by_email", method: "GET" })
  .inputValidator(z.object({ email: z.email() }))
  .handler(async ({ data }) => {
    const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1)
    if (!user) {
      throw new Error("User not found")
    }
    return user
  })

export const getUserByAuthUserId = createMonitoredDbFn({ eventName: "web.user.get_by_auth_user_id", method: "GET" })
  .inputValidator(z.object({ authUserId: z.string() }))
  .handler(async ({ data }) => {
    const [user] = await db.select().from(users).where(eq(users.id, data.authUserId)).limit(1)

    if (!user) {
      throw new Error("User not found")
    }

    return user
  })

// ** UPDATE **
// partial create schema with id required
export const UpdateUserSchema = CreateUserSchema.partial().extend({
  id: z.string(),
})

export const updateUser = createMonitoredDbFn({ eventName: "web.user.update", method: "POST" })
  .inputValidator(UpdateUserSchema)
  .handler(async ({ data }) => {
    const { id, ...updateData } = data
    const updatedUser = await db.update(users).set(updateData).where(eq(users.id, id))
    if (updatedUser.rowCount === 0) {
      throw new Error("User not found")
    }
    return { success: true }
  })

export const UpdateUserByAuthUserIdSchema = CreateUserSchema.partial().extend({
  authUserId: z.string(),
})

export const updateUserByAuthUserId = createMonitoredDbFn({ eventName: "web.user.update_user_by_auth_user_id", method: "POST" })
  .inputValidator(UpdateUserByAuthUserIdSchema)
  .handler(async ({ data }) => {
    const { authUserId, ...updateData } = data
    const updatedUser = await db.update(users).set(updateData).where(eq(users.id, authUserId))
    if (updatedUser.rowCount === 0) {
      throw new Error("User not found")
    }
    return { success: true }
  })

// ** DELETE **
export const deleteUser = createMonitoredDbFn({ eventName: "web.user.delete", method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await db.delete(users).where(eq(users.id, data.id))
    if (user.rowCount === 0) {
      throw new Error("User not found")
    }
    return { success: true }
  })

export const deleteUserByEmail = createMonitoredDbFn({ eventName: "web.user.delete_user_by_email", method: "POST" })
  .inputValidator(z.object({ email: z.email() }))
  .handler(async ({ data }) => {
    const user = await db.delete(users).where(eq(users.email, data.email))
    if (user.rowCount === 0) {
      throw new Error("User not found")
    }
    return { success: true }
  })
