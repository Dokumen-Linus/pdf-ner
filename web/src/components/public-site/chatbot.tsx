import { useEffect, useRef, useState } from "react"
import { fetchServerSentEvents } from "@tanstack/ai-client"
import { useChat } from "@tanstack/ai-react"
import { Bot, MessageSquare, Send, Sparkles, User, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
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
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 right-0 w-87.5 sm:w-100 h-125 max-h-[calc(100vh-100px)] bg-white border border-[#E5E7EB] shadow-[0_12px_40px_rgba(0,0,0,0.12)] rounded-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#3E6AE1]" />
                <span className="font-medium text-[15px]">Chat</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded-md transition-colors"
                aria-label="Close Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#F8F9FA]"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                  <Bot className="w-10 h-10 mb-3" />
                  <p className="text-[14px]">How can I help you today?</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-3 max-w-[85%]",
                      m.role === "user" ? "ml-auto flex-row-reverse" : "",
                    )}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                        m.role === "user" ? "bg-[#3E6AE1] text-white" : "bg-black text-white",
                      )}
                    >
                      {m.role === "user" ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "rounded-xl px-4 py-2.5 text-[14px] leading-relaxed",
                        m.role === "user"
                          ? "bg-[#3E6AE1] text-white rounded-tr-sm"
                          : "bg-white text-[#171A20] shadow-sm border border-[#E5E7EB] rounded-tl-sm whitespace-pre-wrap",
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
                <div className="flex gap-3 max-w-[85%] animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-white border border-[#E5E7EB] rounded-xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 h-10.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={onSubmit} className="p-3 bg-white border-t border-[#E5E7EB] flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                type="text"
                placeholder="Ask about Dokumen AI..."
                className="flex-1 bg-[#F4F4F4] text-[14px] rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-[#3E6AE1]/20 transition-all border border-transparent focus:border-[#3E6AE1]/50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-[#171A20] hover:bg-black text-white w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors"
                aria-label="Send Message"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-[#171A20] hover:bg-black shadow-lg shadow-black/20 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        aria-label="Toggle Chat"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageSquare className="w-6 h-6 text-white" />
        )}
      </button>
    </div>
  )
}
