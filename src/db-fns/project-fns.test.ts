import { describe, expect, it } from "bun:test"
import {
  createProject,
  deleteProject,
  getProjectById,
  getProjectByName,
  getProjectsByOwnerId,
  updateProject,
} from "./projects"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("Project Table Server Functions", () => {
  const testOwnerId = "00000000-0000-0000-0000-000000000001"
  const testName = "Test Project"

  it("should handle the full project lifecycle (CRUD)", async () => {
    // --- CREATE ---
    const createInput = {
      name: testName,
      ownerId: testOwnerId,
      colorPresets: ["#ff0000", "#00ff00"],
      orientation: "portrait" as const,
    }
    const createOutput = await createProject({ data: createInput })
    expect(createOutput.success).toBe(true)

    // --- READ (by name to get the created project) ---
    const projectsByName = await getProjectByName({ data: { name: testName } })
    expect(projectsByName).toBeDefined()
    expect(projectsByName.length).toBeGreaterThan(0)
    expect(projectsByName[0].name).toBe(testName)
    expect(projectsByName[0].ownerId).toBe(testOwnerId)
    const projectId = projectsByName[0].id

    // --- READ (by id) ---
    const projectById = await getProjectById({ data: { id: projectId } })
    expect(projectById).toBeDefined()
    expect(Array.isArray(projectById)).toBe(true)
    expect(projectById.length).toBeGreaterThan(0)
    expect(projectById[0].id).toBe(projectId)
    expect(projectById[0].name).toBe(testName)

    // --- READ (by ownerId) ---
    const projectsByOwnerId = await getProjectsByOwnerId({ data: { ownerId: testOwnerId } })
    expect(projectsByOwnerId).toBeDefined()
    expect(projectsByOwnerId.length).toBeGreaterThan(0)
    expect(projectsByOwnerId[0].ownerId).toBe(testOwnerId)

    // --- UPDATE ---
    const updateInput = {
      id: projectId,
      name: "Updated Project Name",
      colorPresets: ["#0000ff", "#ffff00"],
    }
    const updateOutput = await updateProject({ data: updateInput })
    expect(updateOutput.success).toBe(true)

    const updatedProject = await getProjectById({ data: { id: projectId } })
    expect(updatedProject[0].name).toBe("Updated Project Name")
    expect(updatedProject[0].colorPresets).toEqual(["#0000ff", "#ffff00"])

    // --- DELETE ---
    const deleteOutput = await deleteProject({ data: { id: projectId } })
    expect(deleteOutput.success).toBe(true)

    // Verify deletion
    await expect(getProjectById({ data: { id: projectId } })).rejects.toThrow("Project not found")
  })

  describe("Validation and Error Handling", () => {
    it("throws error for empty name in createProject", async () => {
      const input = {
        name: "", // empty name should fail
        ownerId: testOwnerId,
      }
      await expect(createProject({ data: input })).rejects.toThrow()
    })

    it("throws 'Project not found' for non-existent ID", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(getProjectById({ data: { id: fakeId } })).rejects.toThrow("Project not found")
    })

    it("throws 'Project not found' for non-existent name", async () => {
      await expect(getProjectByName({ data: { name: "Non-existent Project" } })).rejects.toThrow(
        "Project not found",
      )
    })

    it("throws 'Project not found' when updating non-existent project", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(updateProject({ data: { id: fakeId, name: "New Name" } })).rejects.toThrow(
        "Project not found",
      )
    })

    it("throws 'Project not found' when deleting non-existent project", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(deleteProject({ data: { id: fakeId } })).rejects.toThrow("Project not found")
    })
  })
})
