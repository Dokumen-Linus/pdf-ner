import { describe, expect, it } from "bun:test"
import { uploadPdf } from "./storage"

const runTests = process.env.TEST_DB === "true"

describe.if(runTests)("API Storage Functions", () => {
  describe("uploadPdf", () => {
    it("throws 'Unauthorized' when called without a user session", async () => {
      const fakeFileBase64 = Buffer.from("%PDF-1.4 fake").toString("base64")
      await expect(
        uploadPdf({
          data: {
            projectId: "00000000-0000-0000-0000-000000000001",
            bucketId: "00000000-0000-0000-0000-000000000002",
            fileName: "test.pdf",
            fileBase64: fakeFileBase64,
          },
        }),
      ).rejects.toThrow("Unauthorized")
    })
  })
})
