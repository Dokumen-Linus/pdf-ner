import { createServerFn } from "@tanstack/react-start"
import { eq, or, sql } from "drizzle-orm/sql"
import { z } from "zod"

import { db } from "@/db/client"
import { users } from "@/db/schemas/web/users"

// ** CREATE **
export const CreateUserSchema = z.object({
  id: z.string().uuid().optional(),
  authUserId: z.string().optional(),
  email: z.email(),
  displayName: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  employer: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
})

export const createUser = createServerFn({ method: "POST" })
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
export const getUserById = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const [user] = await db.select().from(users).where(eq(users.id, data.id)).limit(1)
    if (!user) {
      throw new Error("User not found")
    }
    return user
  })

export const getUserByEmail = createServerFn({ method: "GET" })
  .inputValidator(z.object({ email: z.email() }))
  .handler(async ({ data }) => {
    const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1)
    if (!user) {
      throw new Error("User not found")
    }
    return user
  })

export const getUserByAuthUserId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ authUserId: z.string() }))
  .handler(async ({ data }) => {
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.authUserId, data.authUserId), sql`${users.id}::text = ${data.authUserId}`))
      .limit(1)

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

export const updateUser = createServerFn({ method: "POST" })
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

export const updateUserByAuthUserId = createServerFn({ method: "POST" })
  .inputValidator(UpdateUserByAuthUserIdSchema)
  .handler(async ({ data }) => {
    const { authUserId, ...updateData } = data
    const updatedUser = await db
      .update(users)
      .set(updateData)
      .where(or(eq(users.authUserId, authUserId), sql`${users.id}::text = ${authUserId}`))
    if (updatedUser.rowCount === 0) {
      throw new Error("User not found")
    }
    return { success: true }
  })

// ** DELETE **
export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const user = await db.delete(users).where(eq(users.id, data.id))
    if (user.rowCount === 0) {
      throw new Error("User not found")
    }
    return { success: true }
  })

export const deleteUserByEmail = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.email() }))
  .handler(async ({ data }) => {
    const user = await db.delete(users).where(eq(users.email, data.email))
    if (user.rowCount === 0) {
      throw new Error("User not found")
    }
    return { success: true }
  })
