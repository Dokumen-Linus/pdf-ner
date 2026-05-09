import { useEffect, useRef, useState } from "react"
import { fetchServerSentEvents } from "@tanstack/ai-client"
import { useChat } from "@tanstack/ai-react"
import { Bot, MessageSquare, Send, Sparkles, User, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { m } from "@/integrations/paraglide/messages.js"
import { cn } from "@/lib/shadcn-ui/utils"

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const { messages, sendMessage, isLoading } = useChat({
    connection: fetchServerSentEvents("/api/chat"),
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    sendMessage(input)
    setInput("")
  }

  return (
    <div className="chatbot-root">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="chatbot-panel"
          >
            {/* Header */}
            <div className="chatbot-header">
              <div className="chatbot-heading">
                <Sparkles className="chatbot-accent-icon h-4 w-4" />
                <span>{m.chatbot_header_title()}</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="chatbot-close-button"
                aria-label={m.chatbot_aria_close()}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="chatbot-messages">
              {messages.length === 0 ? (
                <div className="chatbot-empty">
                  <Bot className="mb-3 h-10 w-10" />
                  <p className="text-[14px]">{m.chatbot_empty_state()}</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "chatbot-message-row",
                      m.role === "user" ? "chatbot-message-row-user" : "",
                    )}
                  >
                    <div
                      className={cn(
                        "chatbot-avatar",
                        m.role === "user" ? "chatbot-avatar-user" : "chatbot-avatar-assistant",
                      )}
                    >
                      {m.role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "chatbot-bubble",
                        m.role === "user" ? "chatbot-bubble-user" : "chatbot-bubble-assistant",
                      )}
                    >
                      {m.parts.map((p, i) =>
                        p.type === "text" ? <span key={i}>{p.content}</span> : null,
                      )}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="chatbot-loading-row">
                  <div className="chatbot-avatar chatbot-avatar-assistant">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="chatbot-loading-bubble">
                    <div className="chatbot-loading-dot" />
                    <div className="chatbot-loading-dot" />
                    <div className="chatbot-loading-dot" />
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={onSubmit} className="chatbot-form">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                type="text"
                placeholder={m.chatbot_input_placeholder()}
                className="chatbot-input"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="chatbot-send-button"
                aria-label={m.chatbot_aria_send()}
              >
                <Send className="ml-0.5 h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="chatbot-toggle"
        aria-label={m.chatbot_aria_toggle()}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageSquare className="h-6 w-6 text-white" />
        )}
      </button>
    </div>
  )
}
