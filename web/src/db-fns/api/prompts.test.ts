import { describe, expect, it } from "bun:test"

import {
  getAllPrompts,
  getPromptById,
  getPromptsByProjectId,
  getPromptsByTemplateId,
} from "./prompts"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("core.prompts (api db-fns re-export)", () => {
  it("getPromptById returns a prompt", async () => {
    const all = await getAllPrompts()
    if (all.length === 0) {
      console.warn("[prompts.test] skipping — no prompts in DB")
      return
    }
    const prompt = await getPromptById({ data: { id: all[0].id } })
    expect(prompt.id).toBe(all[0].id)
  })

  it("getPromptsByProjectId returns prompts for a project", async () => {
    const all = await getAllPrompts()
    if (all.length === 0) {
      console.warn("[prompts.test] skipping — no prompts in DB")
      return
    }
    const result = await getPromptsByProjectId({ data: { projectId: all[0].projectId } })
    expect(result.length).toBeGreaterThan(0)
  })

  it("getPromptById throws for non-existent ID", async () => {
    await expect(
      getPromptById({ data: { id: "00000000-0000-0000-0000-000000000000" } }),
    ).rejects.toThrow("Prompt not found")
  })

  it("getAllPrompts returns an array", async () => {
    const result = await getAllPrompts()
    expect(Array.isArray(result)).toBe(true)
  })

  it("getPromptsByTemplateId returns prompts for a template", async () => {
    const all = await getAllPrompts()
    const withTemplate = all.find((p) => p.templateId != null)
    if (!withTemplate) {
      console.warn("[prompts.test] skipping template filter — no prompts with templateId")
      return
    }
    const result = await getPromptsByTemplateId({ data: { templateId: withTemplate.templateId } })
    expect(result.length).toBeGreaterThan(0)
  })
})
