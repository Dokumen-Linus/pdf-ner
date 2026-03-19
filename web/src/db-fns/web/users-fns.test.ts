import { describe, expect, it } from "bun:test"
import { createUser, deleteUser, getUserByEmail, getUserById, updateUser } from "./users"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("User Table Server Functions", () => {
  const testEmail = `test-${Date.now()}@example.com`

  it("should handle the full user lifecycle (CRUD)", async () => {
    // --- CREATE ---
    const createInput = {
      email: testEmail,
      displayName: "Test User",
      firstName: "Test",
      lastName: "User",
    }
    const createOutput = await createUser({ data: createInput })
    expect(createOutput.id).toBeUuid()

    // --- READ (by email) ---
    const userByEmail = await getUserByEmail({ data: { email: testEmail } })
    expect(userByEmail).toBeDefined()
    expect(userByEmail.email).toBe(testEmail)
    expect(userByEmail.displayName).toBe("Test User")
    expect(userByEmail.firstName).toBe("Test")
    const userId = userByEmail.id

    // --- READ (by id) ---
    const userById = await getUserById({ data: { id: userId } })
    expect(userById).toBeDefined()
    expect(userById.id).toBe(userId)
    expect(userById.email).toBe(testEmail)

    // --- UPDATE ---
    const updateInput = {
      id: userId,
      displayName: "Updated User",
      firstName: "UpdatedName",
      employer: "TestCorp",
    }
    const updateOutput = await updateUser({ data: updateInput })
    expect(updateOutput.success).toBe(true)

    const updatedUser = await getUserById({ data: { id: userId } })
    expect(updatedUser.displayName).toBe("Updated User")
    expect(updatedUser.firstName).toBe("UpdatedName")
    expect(updatedUser.employer).toBe("TestCorp")

    // --- DELETE ---
    const deleteOutput = await deleteUser({ data: { id: userId } })
    expect(deleteOutput.success).toBe(true)

    // Verify deletion
    await expect(getUserById({ data: { id: userId } })).rejects.toThrow("User not found")
  })

  describe("Validation and Error Handling", () => {
    it("throws error for invalid email format in createUser", async () => {
      const input = {
        email: "invalid-email",
      }
      await expect(createUser({ data: input })).rejects.toThrow()
    })

    it("throws 'User not found' for non-existent ID", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(getUserById({ data: { id: fakeId } })).rejects.toThrow("User not found")
    })

    it("throws 'User not found' for non-existent email", async () => {
      await expect(getUserByEmail({ data: { email: "nobody@example.com" } })).rejects.toThrow(
        "User not found",
      )
    })

    it("throws 'User not found' when updating non-existent user", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(updateUser({ data: { id: fakeId, firstName: "New" } })).rejects.toThrow(
        "User not found",
      )
    })

    it("throws 'User not found' when deleting non-existent user", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(deleteUser({ data: { id: fakeId } })).rejects.toThrow("User not found")
    })
  })
})
