import { describe, expect, it } from "bun:test"

import {
  getAllWorkersPdfs,
  getWorkersPdfById,
  getWorkersPdfsByExtractMethod,
  getWorkersPdfsByModelType,
  getWorkersPdfsByName,
  getWorkersPdfsByProjectId,
} from "./pdfs"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("Workers PDFs Read-Only Functions", () => {
  describe("getAllWorkersPdfs", () => {
    it("returns an array of workers PDFs", async () => {
      const result = await getAllWorkersPdfs()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe("getWorkersPdfById", () => {
    it("returns a workers PDF when it exists", async () => {
      const allPdfs = await getAllWorkersPdfs()
      if (allPdfs.length > 0) {
        const firstPdf = allPdfs[0]
        const result = await getWorkersPdfById({ data: { id: firstPdf.id } })
        expect(result).toBeDefined()
        expect(result.id).toBe(firstPdf.id)
      }
    })

    it("throws 'Workers PDF not found' for non-existent ID", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(getWorkersPdfById({ data: { id: fakeId } })).rejects.toThrow(
        "Workers PDF not found",
      )
    })
  })

  describe("getWorkersPdfsByProjectId", () => {
    it("returns an array of workers PDFs for a project", async () => {
      const allPdfs = await getAllWorkersPdfs()
      if (allPdfs.length > 0) {
        const projectId = allPdfs[0].projectId
        const result = await getWorkersPdfsByProjectId({ data: { projectId } })
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBeGreaterThan(0)
        for (const pdf of result) {
          expect(pdf.projectId).toBe(projectId)
        }
      }
    })

    it("returns an empty array for non-existent project ID", async () => {
      const fakeProjectId = "00000000-0000-0000-0000-000000000000"
      const result = await getWorkersPdfsByProjectId({ data: { projectId: fakeProjectId } })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })
  })

  describe("getWorkersPdfsByName", () => {
    it("returns an array of workers PDFs with matching name", async () => {
      const allPdfs = await getAllWorkersPdfs()
      const pdfWithName = allPdfs.find((p) => p.name !== null)
      if (pdfWithName) {
        const result = await getWorkersPdfsByName({ data: { name: pdfWithName.name! } })
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBeGreaterThan(0)
        for (const pdf of result) {
          expect(pdf.name).toBe(pdfWithName.name)
        }
      }
    })

    it("returns an empty array for non-existent name", async () => {
      const result = await getWorkersPdfsByName({
        data: { name: "non_existent_pdf_name_xyz.pdf" },
      })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })
  })

  describe("getWorkersPdfsByExtractMethod", () => {
    it("returns an array of workers PDFs with matching extract method", async () => {
      const allPdfs = await getAllWorkersPdfs()
      const pdfWithMethod = allPdfs.find((p) => p.extractMethod !== null)
      if (pdfWithMethod) {
        const result = await getWorkersPdfsByExtractMethod({
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
      const result = await getWorkersPdfsByExtractMethod({
        data: { extractMethod: "non_existent_method" },
      })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })
  })

  describe("getWorkersPdfsByModelType", () => {
    it("returns an array of workers PDFs with matching model type", async () => {
      const allPdfs = await getAllWorkersPdfs()
      const pdfWithModelType = allPdfs.find((p) => p.modelType !== null)
      if (pdfWithModelType) {
        const result = await getWorkersPdfsByModelType({
          data: { modelType: pdfWithModelType.modelType! },
        })
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBeGreaterThan(0)
        for (const pdf of result) {
          expect(pdf.modelType).toBe(pdfWithModelType.modelType)
        }
      }
    })

    it("returns an empty array for non-existent model type", async () => {
      const result = await getWorkersPdfsByModelType({
        data: { modelType: "non_existent_model_type" },
      })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })
  })
})
