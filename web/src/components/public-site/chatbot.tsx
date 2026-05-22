import { useEffect, useRef, useState } from "react"
import { fetchServerSentEvents } from "@tanstack/ai-client"
import { useChat } from "@tanstack/ai-react"
import { Bot, MessageSquare, Send, Sparkles, User, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { m } from "@/integrations/paraglide/messages.js"
import { cn } from "@/lib/shadcn-ui/utils"

import "./chatbot.css"

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
            className="panel"
          >
            {/* Header */}
            <header>
              <h2>
                <Sparkles className="h-4 w-4" />
                <span>{m.chatbot_header_title()}</span>
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                aria-label={m.chatbot_aria_close()}
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Messages */}
            <div ref={scrollRef} className="messages">
              {messages.length === 0 ? (
                <div className="empty">
                  <Bot className="mb-3 h-10 w-10" />
                  <p className="text-[14px]">{m.chatbot_empty_state()}</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "row",
                      m.role === "user" ? "user" : "",
                    )}
                  >
                    <div className="avatar">
                      {m.role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div className="bubble">
                      {m.parts.map((p, i) =>
                        p.type === "text" ? <span key={i}>{p.content}</span> : null,
                      )}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="row loading">
                  <div className="avatar">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bubble loading">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={onSubmit}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                type="text"
                placeholder={m.chatbot_input_placeholder()}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
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
        className="toggle"
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

