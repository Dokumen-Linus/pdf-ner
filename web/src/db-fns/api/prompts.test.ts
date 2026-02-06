import { describe, expect, it } from "bun:test"
import {
  getAllPrompts,
  getPromptById,
  getPromptsByProjectId,
  getPromptsByTemplateId,
} from "./prompts"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("API Prompts Read-Only Functions", () => {
  describe("getAllPrompts", () => {
    it("returns an array of prompts", async () => {
      const result = await getAllPrompts({ data: {} })
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe("getPromptById", () => {
    it("returns a prompt when it exists", async () => {
      const allPrompts = await getAllPrompts({ data: {} })
      if (allPrompts.length > 0) {
        const firstPrompt = allPrompts[0]
        const result = await getPromptById({ data: { id: firstPrompt.id } })
        expect(result).toBeDefined()
        expect(result.id).toBe(firstPrompt.id)
        expect(result.projectId).toBe(firstPrompt.projectId)
      }
    })

    it("throws 'Prompt not found' for non-existent ID", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(getPromptById({ data: { id: fakeId } })).rejects.toThrow("Prompt not found")
    })
  })

  describe("getPromptsByProjectId", () => {
    it("returns an array of prompts for a project", async () => {
      const allPrompts = await getAllPrompts({ data: {} })
      if (allPrompts.length > 0) {
        const projectId = allPrompts[0].projectId
        const result = await getPromptsByProjectId({ data: { projectId } })
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBeGreaterThan(0)
        for (const prompt of result) {
          expect(prompt.projectId).toBe(projectId)
        }
      }
    })

    it("returns an empty array for non-existent project ID", async () => {
      const fakeProjectId = "00000000-0000-0000-0000-000000000000"
      const result = await getPromptsByProjectId({ data: { projectId: fakeProjectId } })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })
  })

  describe("getPromptsByTemplateId", () => {
    it("returns an array of prompts for a template", async () => {
      const allPrompts = await getAllPrompts({ data: {} })
      const promptWithTemplate = allPrompts.find((p) => p.templateId !== null)
      if (promptWithTemplate) {
        const result = await getPromptsByTemplateId({ data: { templateId: promptWithTemplate.templateId! } })
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBeGreaterThan(0)
        for (const prompt of result) {
          expect(prompt.templateId).toBe(promptWithTemplate.templateId)
        }
      }
    })

    it("returns an empty array for non-existent template ID", async () => {
      const fakeTemplateId = 999999
      const result = await getPromptsByTemplateId({ data: { templateId: fakeTemplateId } })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })
  })
})
