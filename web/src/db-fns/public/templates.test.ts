import { describe, expect, it } from "bun:test"

import { getAllTemplates, getTemplateById, getTemplatesByDocumentAtEnd } from "./templates"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("Public Templates Read-Only Functions", () => {
  describe("getAllTemplates", () => {
    it("returns an array of templates", async () => {
      const result = await getAllTemplates({ data: {} })
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe("getTemplateById", () => {
    it("returns a template when it exists", async () => {
      const allTemplates = await getAllTemplates({ data: {} })
      if (allTemplates.length > 0) {
        const firstTemplate = allTemplates[0]
        const result = await getTemplateById({ data: { id: firstTemplate.id } })
        expect(result).toBeDefined()
        expect(result.id).toBe(firstTemplate.id)
        expect(result.txt).toBe(firstTemplate.txt)
      }
    })

    it("throws 'Template not found' for non-existent ID", async () => {
      const fakeId = 999999
      await expect(getTemplateById({ data: { id: fakeId } })).rejects.toThrow("Template not found")
    })
  })

  describe("getTemplatesByDocumentAtEnd", () => {
    it("returns an array of templates with documentAtEnd true", async () => {
      const result = await getTemplatesByDocumentAtEnd({ data: { documentAtEnd: true } })
      expect(Array.isArray(result)).toBe(true)
      for (const template of result) {
        expect(template.documentAtEnd).toBe(true)
      }
    })

    it("returns an array of templates with documentAtEnd false", async () => {
      const result = await getTemplatesByDocumentAtEnd({ data: { documentAtEnd: false } })
      expect(Array.isArray(result)).toBe(true)
      for (const template of result) {
        expect(template.documentAtEnd).toBe(false)
      }
    })
  })
})
