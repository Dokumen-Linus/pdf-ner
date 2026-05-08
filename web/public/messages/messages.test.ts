import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "bun:test"

const messagesDir = dirname(fileURLToPath(import.meta.url))

async function readMessageKeys(locale: "en" | "fr") {
  const raw = await readFile(join(messagesDir, `${locale}.json`), "utf8")
  return Object.keys(JSON.parse(raw) as Record<string, unknown>).sort()
}

describe("message catalogs", () => {
  it("keeps en.json and fr.json key sets equal", async () => {
    const [enKeys, frKeys] = await Promise.all([readMessageKeys("en"), readMessageKeys("fr")])

    expect(frKeys).toEqual(enKeys)
  })
})
