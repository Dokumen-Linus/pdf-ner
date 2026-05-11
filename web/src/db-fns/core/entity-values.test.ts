import { describe, expect, it } from "bun:test"

import {
  getEntityValuesByPdfId,
  getEntityValuesByPdfIdAndEntityTypeId,
  getLabelsByPdfId,
  getPredictionsByPdfId,
} from "./entity-values"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("core.entity_values", () => {
  it("getEntityValuesByPdfId returns values for a PDF", async () => {
    const values = await getEntityValuesByPdfId({
      data: { pdfId: "00000000-0000-0000-0000-000000000001" },
    })
    expect(Array.isArray(values)).toBe(true)
  })

  it("getEntityValuesByPdfIdAndEntityTypeId returns filtered values", async () => {
    const values = await getEntityValuesByPdfIdAndEntityTypeId({
      data: {
        pdfId: "00000000-0000-0000-0000-000000000001",
        entityTypeId: "00000000-0000-0000-0000-000000000101",
      },
    })
    expect(Array.isArray(values)).toBe(true)
  })

  it("getLabelsByPdfId returns labels for a PDF", async () => {
    const labels = await getLabelsByPdfId({
      data: { pdfId: "00000000-0000-0000-0000-000000000001" },
    })
    expect(Array.isArray(labels)).toBe(true)
  })

  it("getPredictionsByPdfId returns predictions for a PDF", async () => {
    const predictions = await getPredictionsByPdfId({
      data: { pdfId: "00000000-0000-0000-0000-000000000001" },
    })
    expect(Array.isArray(predictions)).toBe(true)
  })
})
