import { describe, expect, it } from "bun:test"
import {
  createEntityType,
  deleteEntityType,
  getEntityTypeById,
  getEntityTypesByProjectId,
  updateEntityType,
} from "./entity-types"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("Entity Type Table Server Functions", () => {
  const testProjectId = "00000000-0000-0000-0000-000000000001"
  const testName = "Test Entity Type"

  it("should handle the full entity type lifecycle (CRUD)", async () => {
    // --- CREATE ---
    const createInput = {
      projectId: testProjectId,
      name: testName,
      page1Definition: "Test definition",
      page1Examples: ["example1", "example2"],
      page1Datatype: "string",
      unique: true,
      required: true,
      subtype: "test-subtype",
      color: "#ff0000",
      opacity: 0.8,
    }
    const createOutput = await createEntityType({ data: createInput })
    expect(createOutput.id).toBeUuid()

    // --- READ (by projectId to get the created entity type) ---
    const entityTypesForLookup = await getEntityTypesByProjectId({
      data: { projectId: testProjectId },
    })
    expect(entityTypesForLookup).toBeDefined()
    expect(entityTypesForLookup.length).toBeGreaterThan(0)

    const createdEntityType = entityTypesForLookup.find((et) => et.name === testName)
    expect(createdEntityType).toBeDefined()
    expect(createdEntityType!.projectId).toBe(testProjectId)
    expect(createdEntityType!.name).toBe(testName)
    const entityTypeId = createdEntityType!.id

    // --- READ (by id) ---
    const entityTypeById = await getEntityTypeById({ data: { id: entityTypeId } })
    expect(entityTypeById).toBeDefined()
    expect(entityTypeById.projectId).toBe(testProjectId)
    expect(entityTypeById.name).toBe(testName)

    // --- UPDATE ---
    const updateInput = {
      id: entityTypeId,
      page1Definition: "Updated definition",
      color: "#00ff00",
      opacity: 0.9,
    }
    const updateOutput = await updateEntityType({ data: updateInput })
    expect(updateOutput.success).toBe(true)

    const updatedEntityType = await getEntityTypeById({ data: { id: entityTypeId } })
    expect(updatedEntityType.userDefinition).toBe("Updated definition")
    expect(updatedEntityType.color).toBe("#00ff00")
    expect(updatedEntityType.opacity).toBe(0.9)

    // --- DELETE ---
    const deleteOutput = await deleteEntityType({ data: { id: entityTypeId } })
    expect(deleteOutput.success).toBe(true)

    // Verify deletion
    await expect(getEntityTypeById({ data: { id: entityTypeId } })).rejects.toThrow(
      "Entity type not found",
    )
  })

  describe("Validation and Error Handling", () => {
    it("throws error for empty name in createEntityType", async () => {
      const input = {
        projectId: testProjectId,
        name: "", // empty name should fail
        unique: true,
        required: false,
      }
      await expect(createEntityType({ data: input })).rejects.toThrow()
    })

    it("throws 'Entity type not found' for non-existent ID", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(getEntityTypeById({ data: { id: fakeId } })).rejects.toThrow(
        "Entity type not found",
      )
    })

    it("throws 'Entity type not found' when updating non-existent entity type", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(updateEntityType({ data: { id: fakeId, name: "New Name" } })).rejects.toThrow(
        "Entity type not found",
      )
    })

    it("throws 'Entity type not found' when deleting non-existent entity type", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(deleteEntityType({ data: { id: fakeId } })).rejects.toThrow(
        "Entity type not found",
      )
    })
  })
})
