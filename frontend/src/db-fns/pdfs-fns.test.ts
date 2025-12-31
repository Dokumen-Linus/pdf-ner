import { describe, expect, it } from "bun:test"
import {
  createPdf,
  deletePdf,
  getPdfByFilename,
  getPdfById,
  getPdfsByProjectId,
  updatePdf,
} from "./pdfs"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("PDF Table Server Functions", () => {
  const testProjectId = "00000000-0000-0000-0000-000000000001"
  const testFilename = "test-document.pdf"

  it("should handle the full PDF lifecycle (CRUD)", async () => {
    // --- CREATE ---
    const createInput = {
      projectId: testProjectId,
      filename: testFilename,
    }
    const createOutput = await createPdf({ data: createInput })
    expect(isUuidV4(createOutput.id)).toBe(true)

    // --- READ (by filename to get the created PDF) ---
    const pdfByFilename = await getPdfByFilename({ data: { filename: testFilename } })
    expect(pdfByFilename).toBeDefined()
    expect(pdfByFilename.filename).toBe(testFilename)
    expect(pdfByFilename.projectId).toBe(testProjectId)
    const pdfId = pdfByFilename.id

    // --- READ (by id) ---
    const pdfById = await getPdfById({ data: { id: pdfId } })
    expect(pdfById).toBeDefined()
    expect(pdfById.id).toBe(pdfId)
    expect(pdfById.filename).toBe(testFilename)

    // --- READ (by projectId) ---
    const pdfsByProjectId = await getPdfsByProjectId({ data: { projectId: testProjectId } })
    expect(pdfsByProjectId).toBeDefined()
    expect(pdfsByProjectId.length).toBeGreaterThan(0)
    expect(pdfsByProjectId[0].projectId).toBe(testProjectId)

    // --- UPDATE ---
    const updateInput = {
      id: pdfId,
      filename: "updated-document.pdf",
    }
    const updateOutput = await updatePdf({ data: updateInput })
    expect(updateOutput.success).toBe(true)

    const updatedPdf = await getPdfById({ data: { id: pdfId } })
    expect(updatedPdf.filename).toBe("updated-document.pdf")

    // --- DELETE ---
    const deleteOutput = await deletePdf({ data: { id: pdfId } })
    expect(deleteOutput.success).toBe(true)

    // Verify deletion
    await expect(getPdfById({ data: { id: pdfId } })).rejects.toThrow("PDF not found")
  })

  describe("Validation and Error Handling", () => {
    it("throws error for empty filename in createPdf", async () => {
      const input = {
        projectId: testProjectId,
        filename: "", // empty filename should fail
      }
      await expect(createPdf({ data: input })).rejects.toThrow()
    })

    it("throws 'PDF not found' for non-existent ID", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(getPdfById({ data: { id: fakeId } })).rejects.toThrow("PDF not found")
    })

    it("throws 'PDF not found' for non-existent filename", async () => {
      await expect(getPdfByFilename({ data: { filename: "non-existent.pdf" } })).rejects.toThrow(
        "PDF not found",
      )
    })

    it("throws 'PDF not found' when updating non-existent PDF", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(updatePdf({ data: { id: fakeId, filename: "new.pdf" } })).rejects.toThrow(
        "PDF not found",
      )
    })

    it("throws 'PDF not found' when deleting non-existent PDF", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(deletePdf({ data: { id: fakeId } })).rejects.toThrow("PDF not found")
    })
  })
})
