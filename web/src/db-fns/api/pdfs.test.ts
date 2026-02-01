import { describe, expect, it } from "bun:test"
import {
  getAllApiPdfs,
  getApiPdfById,
  getApiPdfsByExtractMethod,
  getApiPdfsByModelType,
  getApiPdfsByName,
  getApiPdfsByProjectId,
} from "./pdfs"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("API PDFs Read-Only Functions", () => {
  describe("getAllApiPdfs", () => {
    it("returns an array of API PDFs", async () => {
      const result = await getAllApiPdfs({ data: {} })
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe("getApiPdfById", () => {
    it("returns an API PDF when it exists", async () => {
      const allPdfs = await getAllApiPdfs({ data: {} })
      if (allPdfs.length > 0) {
        const firstPdf = allPdfs[0]
        const result = await getApiPdfById({ data: { id: firstPdf.id } })
        expect(result).toBeDefined()
        expect(result.id).toBe(firstPdf.id)
        expect(result.name).toBe(firstPdf.name)
      }
    })

    it("throws 'API PDF not found' for non-existent ID", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(getApiPdfById({ data: { id: fakeId } })).rejects.toThrow("API PDF not found")
    })
  })

  describe("getApiPdfsByProjectId", () => {
    it("returns an array of API PDFs for a project", async () => {
      const allPdfs = await getAllApiPdfs({ data: {} })
      if (allPdfs.length > 0) {
        const projectId = allPdfs[0].projectId
        const result = await getApiPdfsByProjectId({ data: { projectId } })
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBeGreaterThan(0)
        for (const pdf of result) {
          expect(pdf.projectId).toBe(projectId)
        }
      }
    })

    it("returns an empty array for non-existent project ID", async () => {
      const fakeProjectId = "00000000-0000-0000-0000-000000000000"
      const result = await getApiPdfsByProjectId({ data: { projectId: fakeProjectId } })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })
  })

  describe("getApiPdfsByName", () => {
    it("returns an array of API PDFs with matching name", async () => {
      const allPdfs = await getAllApiPdfs({ data: {} })
      if (allPdfs.length > 0) {
        const pdfName = allPdfs[0].name
        const result = await getApiPdfsByName({ data: { name: pdfName } })
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBeGreaterThan(0)
        for (const pdf of result) {
          expect(pdf.name).toBe(pdfName)
        }
      }
    })

    it("returns an empty array for non-existent name", async () => {
      const result = await getApiPdfsByName({ data: { name: "non_existent_pdf_name_xyz.pdf" } })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })
  })

  describe("getApiPdfsByExtractMethod", () => {
    it("returns an array of API PDFs with matching extract method", async () => {
      const allPdfs = await getAllApiPdfs({ data: {} })
      const pdfWithMethod = allPdfs.find((p) => p.extractMethod !== null)
      if (pdfWithMethod) {
        const result = await getApiPdfsByExtractMethod({
          data: { extractMethod: pdfWithMethod.extractMethod! },
        })
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBeGreaterThan(0)
        for (const pdf of result) {
          expect(pdf.extractMethod).toBe(pdfWithMethod.extractMethod)
        }
      }
    })

    it("returns an empty array for non-existent extract method", async () => {
      const result = await getApiPdfsByExtractMethod({ data: { extractMethod: "non_existent_method" } })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })
  })

  describe("getApiPdfsByModelType", () => {
    it("returns an array of API PDFs with matching model type", async () => {
      const allPdfs = await getAllApiPdfs({ data: {} })
      const pdfWithModelType = allPdfs.find((p) => p.modelType !== null)
      if (pdfWithModelType) {
        const result = await getApiPdfsByModelType({ data: { modelType: pdfWithModelType.modelType! } })
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBeGreaterThan(0)
        for (const pdf of result) {
          expect(pdf.modelType).toBe(pdfWithModelType.modelType)
        }
      }
    })

    it("returns an empty array for non-existent model type", async () => {
      const result = await getApiPdfsByModelType({ data: { modelType: "non_existent_model_type" } })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })
  })
})
