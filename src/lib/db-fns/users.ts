import { createServerFn } from "@tanstack/react-start"
import { db } from "~/db/drizzle/client"
import { users } from "~/db/drizzle/schema/users"
import { z } from "zod"

const CreateUserSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  employer: z.string().optional(),
  jobTitle: z.string().optional(),
})

export const createUser = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof CreateUserSchema>) => CreateUserSchema.parse(data))
  .handler(async ({ data }) => {
    const newUser = await db.insert(users).values(data).returning()
    return newUser[0]
  })
