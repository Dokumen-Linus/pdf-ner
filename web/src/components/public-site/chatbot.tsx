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
    <div className="fixed right-6 bottom-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 bottom-16 flex h-125 max-h-[calc(100vh-100px)] w-87.5 flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] sm:w-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#3E6AE1]" />
                <span className="text-[15px] font-medium">{m.chatbot_header_title()}</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 transition-colors hover:bg-white/10"
                aria-label={m.chatbot_aria_close()}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex flex-1 flex-col gap-4 overflow-y-auto bg-[#F8F9FA] p-4"
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center opacity-60">
                  <Bot className="mb-3 h-10 w-10" />
                  <p className="text-[14px]">{m.chatbot_empty_state()}</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex max-w-[85%] gap-3",
                      m.role === "user" ? "ml-auto flex-row-reverse" : "",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        m.role === "user" ? "bg-[#3E6AE1] text-white" : "bg-black text-white",
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
                        "rounded-xl px-4 py-2.5 text-[14px] leading-relaxed",
                        m.role === "user"
                          ? "rounded-tr-sm bg-[#3E6AE1] text-white"
                          : "rounded-tl-sm border border-[#E5E7EB] bg-white whitespace-pre-wrap text-[#171A20] shadow-sm",
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
                <div className="flex max-w-[85%] animate-pulse gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex h-10.5 items-center gap-1.5 rounded-xl rounded-tl-sm border border-[#E5E7EB] bg-white px-4 py-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={onSubmit} className="flex gap-2 border-t border-[#E5E7EB] bg-white p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                type="text"
                placeholder={m.chatbot_input_placeholder()}
                className="flex-1 rounded-lg border border-transparent bg-[#F4F4F4] px-4 py-2 text-[14px] transition-all outline-none focus:border-[#3E6AE1]/50 focus:ring-2 focus:ring-[#3E6AE1]/20"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#171A20] text-white transition-colors hover:bg-black disabled:opacity-50"
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
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#171A20] shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-black active:scale-95"
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
