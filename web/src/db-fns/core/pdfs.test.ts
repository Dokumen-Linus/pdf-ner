import { describe, expect, it } from "bun:test"

import { getCorePdfById, getCorePdfsByProjectId, getCorePdfsCountByProjectId } from "./pdfs"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("core.pdfs", () => {
  it("getCorePdfById returns a PDF", async () => {
    const pdf = await getCorePdfById({
      data: { id: "00000000-0000-0000-0000-000000000001" },
    })
    expect(pdf).toBeDefined()
    expect(pdf.id).toBe("00000000-0000-0000-0000-000000000001")
  })

  it("getCorePdfsByProjectId returns PDFs for a project", async () => {
    const pdfs = await getCorePdfsByProjectId({
      data: { projectId: "00000000-0000-0000-0000-000000000001" },
    })
    expect(Array.isArray(pdfs)).toBe(true)
  })

  it("getCorePdfsCountByProjectId returns a count", async () => {
    const count = await getCorePdfsCountByProjectId({
      data: { projectId: "00000000-0000-0000-0000-000000000001" },
    })
    expect(typeof count).toBe("number")
  })

  it("getCorePdfById throws for non-existent ID", async () => {
    await expect(
      getCorePdfById({ data: { id: "00000000-0000-0000-0000-000000000000" } }),
    ).rejects.toThrow("PDF not found")
  })
})
