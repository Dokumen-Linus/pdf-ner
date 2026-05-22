import { describe, expect, it } from "bun:test"

import { createApplication, deleteApplication, getApplicationById } from "./applications"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("Application Table Server Functions", () => {
  const testEmail = `test-applicant-${Date.now()}@example.com`

  it("should handle the full application lifecycle (CRUD)", async () => {
    // --- CREATE ---
    const createInput = {
      name: "John Applicant",
      email: testEmail,
      phone: "123-456-7890",
      message: "I would love to join your team!",
    }
    const createOutput = await createApplication({ data: createInput })
    expect(typeof createOutput.id).toBe("number")
    const appIntId = createOutput.id

    // --- READ ---
    const appById = await getApplicationById({ data: { id: appIntId } })
    expect(appById).toBeDefined()
    expect(appById.id).toBe(appIntId)
    expect(appById.name).toBe("John Applicant")
    expect(appById.email).toBe(testEmail)
    expect(appById.phone).toBe("123-456-7890")
    expect(appById.message).toBe("I would love to join your team!")

    // --- DELETE ---
    const deleteOutput = await deleteApplication({ data: { id: appIntId } })
    expect(deleteOutput.success).toBe(true)

    // Verify deletion
    await expect(getApplicationById({ data: { id: appIntId } })).rejects.toThrow(
      "Application not found",
    )
  })

  describe("Validation and Error Handling", () => {
    it("throws error for invalid email format in createApplication", async () => {
      const input = {
        name: "Test User",
        email: "invalid-email",
      }
      await expect(createApplication({ data: input })).rejects.toThrow()
    })

    it("throws 'Application not found' for non-existent ID", async () => {
      await expect(getApplicationById({ data: { id: 9999999 } })).rejects.toThrow(
        "Application not found",
      )
    })

    it("throws 'Application not found' when deleting non-existent application", async () => {
      await expect(deleteApplication({ data: { id: 9999999 } })).rejects.toThrow(
        "Application not found",
      )
    })
  })
})
