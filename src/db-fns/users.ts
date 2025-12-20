import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm/sql"
import { z } from "zod"
import { db } from "@/db/client"
import { users } from "@/db/schema/users"

const MIN_PW_LEN = 8

// ** CREATE **
const CreateUserSchema = z.object({
  email: z.email(),
  password: z.string().min(MIN_PW_LEN, `Password must be at least ${MIN_PW_LEN} characters long`),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  employer: z.string().optional(),
  jobTitle: z.string().optional(),
})

export const createUser = createServerFn({ method: "POST" })
  .inputValidator(CreateUserSchema)
  .handler(async ({ data }) => {
    await db.insert(users).values(data)
    return { success: true }
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

// ** UPDATE **
// partial create schema with id still required
const UpdateUserSchema = CreateUserSchema.partial().extend({
  id: z.string(),
})

export const updateUser = createServerFn({ method: "POST" })
  .inputValidator(UpdateUserSchema)
  .handler(async ({ data }) => {
    const updatedUser = await db.update(users).set(data).where(eq(users.id, data.id))
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
