import { describe, expect, it } from "bun:test"

import { getAllApiPdfs, getApiPdfById } from "./pdfs"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("API PDFs Read-Only Functions", () => {
  describe("getAllApiPdfs", () => {
    it("returns an array of API PDFs", async () => {
      const result = await getAllApiPdfs()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe("getApiPdfById", () => {
    it("returns an API PDF when it exists", async () => {
      const allPdfs = await getAllApiPdfs()
      if (allPdfs.length > 0) {
        const firstPdf = allPdfs[0]
        const result = await getApiPdfById({ data: { id: firstPdf.id } })
        expect(result).toBeDefined()
        expect(result.id).toBe(firstPdf.id)
      }
    })

    it("throws 'API PDF not found' for non-existent ID", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(getApiPdfById({ data: { id: fakeId } })).rejects.toThrow("API PDF not found")
    })
  })
})
