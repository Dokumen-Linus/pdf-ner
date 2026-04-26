import { describe, expect, it } from "bun:test"

import { getAllModels, getModelById, getModelsByProvider } from "./models"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("Public Models Read-Only Functions", () => {
  describe("getAllModels", () => {
    it("returns an array of models", async () => {
      const result = await getAllModels()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe("getModelById", () => {
    it("returns a model when it exists", async () => {
      const allModels = await getAllModels()
      if (allModels.length > 0) {
        const firstModel = allModels[0]
        const result = await getModelById({ data: { id: firstModel.id } })
        expect(result).toBeDefined()
        expect(result.id).toBe(firstModel.id)
        expect(result.provider).toBe(firstModel.provider)
      }
    })

    it("throws 'Model not found' for non-existent ID", async () => {
      const fakeId = "non_existent_model_xyz"
      await expect(getModelById({ data: { id: fakeId } })).rejects.toThrow("Model not found")
    })
  })

  describe("getModelsByProvider", () => {
    it("returns an array of models for a provider", async () => {
      const result = await getModelsByProvider({ data: { provider: "openai" } })
      expect(Array.isArray(result)).toBe(true)
      for (const model of result) {
        expect(model.provider).toBe("openai")
      }
    })

    it("returns an empty array for non-existent provider", async () => {
      const result = await getModelsByProvider({ data: { provider: "non_existent_provider" } })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })
  })
})
