import { describe, expect, it } from "bun:test"

import { getAllTemplates, getTemplateById } from "./templates"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("public.templates", () => {
  it("getTemplateById returns a template", async () => {
    const all = await getAllTemplates()
    if (all.length === 0) {
      console.warn("[templates.test] skipping — no templates in DB")
      return
    }
    const template = await getTemplateById({ data: { id: all[0].id } })
    expect(template.id).toBe(all[0].id)
  })

  it("getAllTemplates returns an array", async () => {
    const result = await getAllTemplates()
    expect(Array.isArray(result)).toBe(true)
  })

  it("getTemplateById throws for non-existent ID", async () => {
    await expect(
      getTemplateById({ data: { id: 999999 } }),
    ).rejects.toThrow("Template not found")
  })
})
