import { describe, expect, it } from "bun:test"
import {
  createAnnotation,
  deleteAnnotation,
  getAnnotationById,
  getAnnotationsByPdfId,
  getAnnotationsBySubtype,
  updateAnnotation,
} from "./annotations"
import { isUuidV4 } from "@/lib/misc/uuid"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("Annotation Table Server Functions", () => {
  const testPdfId = "00000000-0000-0000-0000-000000000001"
  const testSubtype = "highlight"
  const testRect = { x: 0, y: 0, width: 100, height: 50 }
  const testSegmentRects = [{ x: 0, y: 0, width: 50, height: 25 }]

  it("should handle the full annotation lifecycle (CRUD)", async () => {
    // --- CREATE ---
    const createInput = {
      pdfId: testPdfId,
      subtype: testSubtype,
      rect: testRect,
      segmentRects: testSegmentRects,
      pageIndex: 0,
      color: "#ffff00",
      opacity: 0.5,
      contents: "Test annotation",
      author: "Test Author",
    }
    const createOutput = await createAnnotation({ data: createInput })
    expect(isUuidV4(createOutput.id)).toBe(true)

    // --- READ (by pdfId and subtype to get the created annotation) ---
    const annotationsForLookup = await getAnnotationsByPdfId({ data: { pdfId: testPdfId } })
    expect(annotationsForLookup).toBeDefined()
    expect(annotationsForLookup.length).toBeGreaterThan(0)

    const createdAnnotation = annotationsForLookup.find(
      (ann: any) => ann.subtype === testSubtype && ann.contents === "Test annotation",
    )
    expect(createdAnnotation).toBeDefined()
    expect(createdAnnotation!.pdfId).toBe(testPdfId)
    expect(createdAnnotation!.subtype).toBe(testSubtype)
    const annotationId = createdAnnotation!.id

    // --- READ (by id) ---
    const annotationById = await getAnnotationById({ data: { id: annotationId } })
    expect(annotationById).toBeDefined()
    expect(annotationById.pdfId).toBe(testPdfId)
    expect(annotationById.subtype).toBe(testSubtype)

    // --- READ (by pdfId) ---
    const annotationsByPdfId = await getAnnotationsByPdfId({ data: { pdfId: testPdfId } })
    expect(annotationsByPdfId).toBeDefined()
    expect(annotationsByPdfId.length).toBeGreaterThan(0)
    expect(annotationsByPdfId[0].pdfId).toBe(testPdfId)

    // --- READ (by subtype) ---
    const annotationsBySubtype = await getAnnotationsBySubtype({ data: { subtype: testSubtype } })
    expect(annotationsBySubtype).toBeDefined()
    expect(annotationsBySubtype.length).toBeGreaterThan(0)
    expect(annotationsBySubtype[0].subtype).toBe(testSubtype)

    // --- UPDATE ---
    const updateInput = {
      id: annotationId,
      color: "#ff0000",
      opacity: 0.8,
      contents: "Updated annotation",
    }
    const updateOutput = await updateAnnotation({ data: updateInput })
    expect(updateOutput.success).toBe(true)

    const updatedAnnotation = await getAnnotationById({ data: { id: annotationId } })
    expect(updatedAnnotation.color).toBe("#ff0000")
    expect(updatedAnnotation.opacity).toBe(0.8)
    expect(updatedAnnotation.contents).toBe("Updated annotation")

    // --- DELETE ---
    const deleteOutput = await deleteAnnotation({ data: { id: annotationId } })
    expect(deleteOutput.success).toBe(true)

    // Verify deletion
    await expect(getAnnotationById({ data: { id: annotationId } })).rejects.toThrow(
      "Annotation not found",
    )
  })

  describe("Validation and Error Handling", () => {
    it("throws error for invalid subtype in createAnnotation", async () => {
      const input = {
        pdfId: testPdfId,
        subtype: "", // empty subtype should fail
        rect: testRect,
        segmentRects: testSegmentRects,
        pageIndex: 0,
      }
      await expect(createAnnotation({ data: input })).rejects.toThrow()
    })

    it("throws error for negative page index", async () => {
      const input = {
        pdfId: testPdfId,
        subtype: testSubtype,
        rect: testRect,
        segmentRects: testSegmentRects,
        pageIndex: -1, // negative page index should fail
      }
      await expect(createAnnotation({ data: input })).rejects.toThrow()
    })

    it("throws 'Annotation not found' for non-existent ID", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(getAnnotationById({ data: { id: fakeId } })).rejects.toThrow(
        "Annotation not found",
      )
    })

    it("throws 'Annotation not found' when updating non-existent annotation", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(updateAnnotation({ data: { id: fakeId, color: "#ff0000" } })).rejects.toThrow(
        "Annotation not found",
      )
    })

    it("throws 'Annotation not found' when deleting non-existent annotation", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      await expect(deleteAnnotation({ data: { id: fakeId } })).rejects.toThrow(
        "Annotation not found",
      )
    })
  })
})
