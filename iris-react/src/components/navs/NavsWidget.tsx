import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X, Send, Sparkles } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useNavs, useNavsGreeting, useNavsSuggestions } from '@/hooks/useNavs'
import { useUIStore } from '@/store/uiStore'

export function NavsWidget() {
  const location = useLocation()
  const { navsWidgetOpen, toggleNavsWidget } = useUIStore()
  const { messages, isTyping, ask } = useNavs()
  const greeting = useNavsGreeting()
  const suggestions = useNavsSuggestions('commandCenter')
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Don't show on Ask Navs page
  if (location.pathname === '/ask-navs') return null
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  useEffect(() => {
    if (navsWidgetOpen) {
      scrollToBottom()
    }
  }, [messages, navsWidgetOpen])
  
  const handleSend = async () => {
    if (!input.trim()) return
    const message = input
    setInput('')
    await ask(message)
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }
  
  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!navsWidgetOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleNavsWidget}
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-dark)] shadow-lg animate-pulse-glow"
          >
            <MessageSquare className="h-6 w-6 text-white" />
          </motion.button>
        )}
      </AnimatePresence>
      
      {/* Chat Panel */}
      <AnimatePresence>
        {navsWidgetOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            className="fixed bottom-6 right-6 z-50 w-96 max-h-[600px] flex flex-col rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-dark)] flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[var(--color-success)] border-2 border-[var(--color-bg-surface)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Ask Navs</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">AI Assistant</p>
                </div>
              </div>
              <button
                onClick={toggleNavsWidget}
                className="rounded-lg p-2 hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                <X className="h-5 w-5 text-[var(--color-text-secondary)]" />
              </button>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[var(--color-text-secondary)] mb-4">{greeting}</p>
                  <div className="space-y-2">
                    {suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => ask(suggestion)}
                        className="block w-full text-left px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-white transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
                        message.role === 'user'
                          ? 'bg-[var(--color-accent-primary)] text-white'
                          : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                      )}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      {message.suggestions && (
                        <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] space-y-1">
                          {message.suggestions.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => ask(s)}
                              className="block text-xs text-[var(--color-text-muted)] hover:text-white transition-colors"
                            >
                              → {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-[var(--color-bg-elevated)] rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input */}
            <div className="p-4 border-t border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything..."
                  className="flex-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-primary)]"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent-primary)] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-accent-glow)] transition-colors"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
