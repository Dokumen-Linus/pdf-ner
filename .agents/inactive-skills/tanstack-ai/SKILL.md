---
name: tanstack-ai
description: >
  Entry point for TanStack AI skills. Routes to chat-experience, tool-calling,
  media-generation, structured-outputs, adapter-configuration, ag-ui-protocol,
  middleware, and custom-backend-integration. Use chat() not streamText(),
  openaiText() not createOpenAI(), toServerSentEventsResponse() not manual SSE,
  middleware hooks not onEnd callbacks.
---

# TanStack AI — Core Concepts

TanStack AI is a type-safe, provider-agnostic AI SDK. Server-side functions
live in `@tanstack/ai` and provider adapter packages. Client-side hooks live
in framework packages (`@tanstack/ai-react`, `@tanstack/ai-solid`, etc.).
Always import from the framework package on the client — never from
`@tanstack/ai-client` directly (unless vanilla JS).

## Sub-Skills

| Need to...                                        | Read                                        |
| ------------------------------------------------- | ------------------------------------------- |
| Build a chat UI with streaming                    | tanstack-ai-chat-experience/SKILL.md            |
| Add tool calling (server, client, or both)        | tanstack-ai-tool-calling/SKILL.md               |
| Generate images, video, speech, or transcriptions | tanstack-ai-media-generation/SKILL.md           |
| Get typed JSON responses from the LLM             | tanstack-ai-structured-outputs/SKILL.md         |
| Choose and configure a provider adapter           | tanstack-ai-adapter-configuration/SKILL.md      |
| Implement AG-UI streaming protocol server-side    | tanstack-ai-ag-ui-protocol/SKILL.md             |
| Add analytics, logging, or lifecycle hooks        | tanstack-ai-middleware/SKILL.md                 |
| Connect to a non-TanStack-AI backend              | tanstack-ai-custom-backend-integration/SKILL.md |
| Set up Code Mode (LLM code execution)             | See `@tanstack/ai-code-mode` package skills |

## Quick Decision Tree

- Setting up a chatbot? → tanstack-ai-chat-experience
- Adding function calling? → tanstack-ai-tool-calling
- Generating media (images, audio, video)? → tanstack-ai-media-generation
- Need structured JSON output? → tanstack-ai-structured-outputs
- Choosing/configuring a provider? → tanstack-ai-adapter-configuration
- Building a server-only AG-UI backend? → tanstack-ai-ag-ui-protocol
- Adding analytics or post-stream events? → tanstack-ai-middleware
- Connecting to a custom backend? → tanstack-ai-custom-backend-integration
- Debugging mistakes? → Check Common Mistakes in the relevant sub-skill

## Critical Rules

1. **This is NOT the Vercel AI SDK.** Use `chat()` not `streamText()`. Use `openaiText()` not `createOpenAI()`. Import from `@tanstack/ai`, not `ai`.
2. **Import from framework package on client.** Use `@tanstack/ai-react` (or solid/vue/svelte/preact), not `@tanstack/ai-client`.
3. **Use `toServerSentEventsResponse()`** to convert streams to HTTP responses. Never implement SSE manually.
4. **Use middleware for lifecycle events.** No `onEnd`/`onFinish` callbacks on `chat()` — use `middleware: [{ onFinish: ... }]`.
5. **Ask the user which adapter and model** they want. Suggest the latest model. Also ask if they want Code Mode.
6. **Tools must be passed to both server and client.** Server gets the tool in `chat({ tools })`, client gets the definition in `useChat({ clientTools })`.

## Version

Targets TanStack AI v0.10.0.
