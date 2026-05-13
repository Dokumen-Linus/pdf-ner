import { describe, expect, it } from "bun:test"

import {
  getAllChatModels,
  getAvailableGoogleChatModels,
  getChatModelById,
  getChatModelsByHost,
} from "./models"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("public.chat_models", () => {
  it("getChatModelById returns a model", async () => {
    const all = await getAllChatModels()
    if (all.length === 0) {
      console.warn("[models.test] skipping — no chat models in DB")
      return
    }
    const model = await getChatModelById({ data: { id: all[0].id } })
    expect(model.id).toBe(all[0].id)
  })

  it("getAllChatModels returns an array", async () => {
    const result = await getAllChatModels()
    expect(Array.isArray(result)).toBe(true)
  })

  it("getChatModelsByHost returns models for a host", async () => {
    const all = await getAllChatModels()
    if (all.length === 0) {
      console.warn("[models.test] skipping host filter — no chat models in DB")
      return
    }
    const result = await getChatModelsByHost({ data: { host: all[0].host } })
    expect(result.length).toBeGreaterThan(0)
  })

  it("getAvailableGoogleChatModels returns active Google models", async () => {
    const result = await getAvailableGoogleChatModels()
    expect(Array.isArray(result)).toBe(true)
    for (const model of result) {
      expect(model.host).toBe("Google")
      expect(model.endAvailableDate == null || model.endAvailableDate > new Date()).toBe(true)
    }
  })

  it("getChatModelById throws for non-existent ID", async () => {
    await expect(getChatModelById({ data: { id: "nonexistent-model" } })).rejects.toThrow(
      "Chat model not found",
    )
  })
})
