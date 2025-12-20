import { createServerFn } from "@tanstack/react-start"
import * as bcrypt from "bcrypt"
import { eq } from "drizzle-orm/sql"
import { z } from "zod"
import { db } from "@/db/client"
import { users } from "@/db/schema/users"

const SALT_ROUNDS = 12
const MIN_PW_LEN = 8

async function hashPassword(password: string) {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

async function verifyPassword(password: string, hash: string) {
  return await bcrypt.compare(password, hash)
}

// ** CREATE **
export const CreateUserSchema = z.object({
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
    const hash = await hashPassword(data.password)
    await db.insert(users).values({ ...data, password: hash })
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

export const verifyUserPassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.email(), password: z.string() }))
  .handler(async ({ data }) => {
    try {
      const user = await getUserByEmail({ data: { email: data.email } })
      const isValid = await verifyPassword(data.password, user.password)
      return { success: isValid }
    } catch (_e) {
      // add a small random delay to prevent timing attacks
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 10))
      // return false genericly to prevent username enumeration attacks
      return { success: false }
    }
  })

// ** UPDATE **
// partial create schema with id required and no password
export const UpdateUserSchema = CreateUserSchema.omit({ password: true }).partial().extend({
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
