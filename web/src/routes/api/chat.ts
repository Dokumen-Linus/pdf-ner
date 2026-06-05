import { readdir, readFile } from "fs/promises"
import { join } from "path"

import {
  chat,
  type ChatMiddleware,
  chatParamsFromRequest,
  toServerSentEventsResponse,
} from "@tanstack/ai"
import { contentGuardMiddleware } from "@tanstack/ai/middlewares"
import { createOpenaiChat } from "@tanstack/ai-openai"
import { createFileRoute } from "@tanstack/react-router"

import { env } from "@/env.server"

const CHAT_MODEL = "gpt-5-nano"

const chatbotPrompt = (knowledge: string) => `You are a helpful assistant on the Dokumen website.
Use the following knowledge to answer questions whenever relevant.
Do not make up information, and if you are unsure be clear about that.
Do not answer questions that do not relate to Dokumen.
Do not ask for screenshots or links, as your only capability is chat.
Do not use markdown formatting

<knowledge>
${knowledge}
</knowledge>`

const chatTelemetryMiddleware: ChatMiddleware = {
  name: "dokumen-chat-telemetry",
  onStart(ctx) {
    console.info("[chat] started", {
      requestId: ctx.requestId,
      threadId: ctx.threadId,
      model: ctx.model,
      messageCount: ctx.messageCount,
    })
  },
  onUsage(ctx, usage) {
    console.info("[chat] usage", {
      requestId: ctx.requestId,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
    })
  },
  onFinish(ctx, info) {
    console.info("[chat] finished", {
      requestId: ctx.requestId,
      duration: info.duration,
      finishReason: info.finishReason,
      totalTokens: info.usage?.totalTokens,
    })
  },
  onError(ctx, info) {
    console.error("[chat] failed", {
      requestId: ctx.requestId,
      duration: info.duration,
      error: info.error instanceof Error ? info.error.message : "Unknown chat error",
    })
  },
  onChunk(_ctx, chunk) {
    if (chunk.type !== "RUN_ERROR") return
    console.error("[chat] stream error", {
      code: "code" in chunk ? chunk.code : undefined,
      message: "message" in chunk ? chunk.message : "Unknown chat stream error",
    })
    return {
      ...chunk,
      message: "Chat is unavailable right now. Please try again later.",
      rawEvent: undefined,
    }
  },
}

const chatContentGuardMiddleware = contentGuardMiddleware({
  rules: [
    { pattern: /\b[\w.-]+@[\w.-]+\.\w+\b/g, replacement: "[email redacted]" },
    { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[phone redacted]" },
  ],
  strategy: "delta",
  onFiltered: (info) => {
    console.info("[chat] content filtered", {
      messageId: info.messageId,
      strategy: info.strategy,
    })
  },
})

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
        if (!env.OPENAI_API_KEY) {
          return new Response("Missing OPENAI_API_KEY", { status: 500 })
        }

        let chatParams: Awaited<ReturnType<typeof chatParamsFromRequest>>
        try {
          chatParams = await chatParamsFromRequest(request)
        } catch (error) {
          if (error instanceof Response) return error
          console.error("Chat request validation error:", error)
          return new Response("Invalid chat request", { status: 400 })
        }

        try {
          const knowledge = await getChatbotKnowledge()
          const systemPrompts = knowledge ? [chatbotPrompt(knowledge)] : undefined

          const stream = chat({
            adapter: createOpenaiChat(CHAT_MODEL, env.OPENAI_API_KEY),
            messages: chatParams.messages,
            middleware: [chatTelemetryMiddleware, chatContentGuardMiddleware],
            runId: chatParams.runId,
            systemPrompts,
            threadId: chatParams.threadId,
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
