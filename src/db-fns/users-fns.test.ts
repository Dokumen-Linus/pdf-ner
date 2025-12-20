import { describe, expect, it } from "bun:test"
import { createUser, getUserByEmail } from "./users"

describe.if(process.env.TEST_DB === "true")("createUser server function", () => {
  it("creates a new user successfully", async () => {
    const input = {
      email: "test@example.com",
      password: "password123",
      firstName: "Test",
      lastName: "User",
    }

    const output = await createUser({ data: input })

    // server function should return success
    expect(output.success).toBe(true)

    // check db for user
    const user = await getUserByEmail({ data: { email: input.email } })
    expect(user).toBeDefined()
    expect(user?.email).toBe(input.email)
  })

  it("throws if email is invalid", async () => {
    const input = {
      email: "not-an-email",
      password: "password123",
    }

    let threw = false
    try {
      await createUser({ data: input })
    } catch (_e) {
      threw = true
    }
    expect(threw).toBe(true)
  })
})
