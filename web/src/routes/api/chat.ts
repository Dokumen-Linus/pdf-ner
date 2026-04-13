import { createFileRoute } from "@tanstack/react-router"
import { chat, toServerSentEventsResponse } from "@tanstack/ai"
import { createOpenaiChat } from "@tanstack/ai-openai"
import { env } from "@/env.server"

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages } = await request.json()
          
          if (!env.OPENAI_API_KEY) {
            return new Response("Missing OPENAI_API_KEY", { status: 500 })
          }

          const stream = chat({
            adapter: createOpenaiChat("gpt-5-nano", env.OPENAI_API_KEY),
            messages,
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
