import { readdir, readFile } from "fs/promises"
import { join } from "path"
import { chat, toServerSentEventsResponse } from "@tanstack/ai"
import { createOpenaiChat } from "@tanstack/ai-openai"
import { createFileRoute } from "@tanstack/react-router"
import { env } from "@/env.server"

async function getChatbotKnowledge() {
  try {
    const knowledgeDir = join(import.meta.dirname, "../../../public/chatbot-knowledge")
    const files = await readdir(knowledgeDir)
    let knowledgeContent = ""

    for (const file of files) {
      if (file.endsWith(".md")) {
        const filePath = join(knowledgeDir, file)
        const content = await readFile(filePath, "utf-8")
        knowledgeContent += `\n--- Document: ${file} ---\n${content}\n`
      }
    }

    return knowledgeContent
  } catch (error) {
    console.error("Failed to load chatbot knowledge:", error)
    return ""
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages } = await request.json()

          if (!env.OPENAI_API_KEY) {
            return new Response("Missing OPENAI_API_KEY", { status: 500 })
          }

          const knowledge = await getChatbotKnowledge()
          let finalMessages = messages

          if (knowledge) {
            finalMessages = [
              {
                role: "system",
                content: `You are a helpful assistant on the Dokumen website.
                Use the following knowledge to answer questions whenever relevant.
                Do not make up information, and if you are unsure be clear about that.
                Do not answer questions that do not relate to Dokumen.
                Do not ask for screenshots or links, as your only capability is chat.
                Do not use markdown formatting

                <knowledge>
                :\n${knowledge}
                </knowledge>`,
              },
              ...messages,
            ]
          }

          const stream = chat({
            adapter: createOpenaiChat("gpt-5-nano", env.OPENAI_API_KEY),
            messages: finalMessages,
          })

          return toServerSentEventsResponse(stream)
        } catch (error) {
          console.error("Chat API error:", error)
          return new Response("Internal Server Error", { status: 500 })
        }
      },
    },
  },
})
