import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Trash2, Settings, RefreshCw, AlertCircle, Code, ChevronDown, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavs, useNavsGreeting, useNavsSuggestions } from '@/hooks/useNavs'
import { useData } from '@/hooks/useData'
import { GlassCard } from '@/components/shared/GlassCard'
import { Markdown } from '@/components/shared/Markdown'
import { NAVS_PERSONA } from '@/lib/navs-persona'
import { ThinkingSteps } from '@/components/navs/ThinkingSteps'
import { ModelSwitcher, ProviderStatusIndicator } from '@/components/navs/ModelSwitcher'

export function AskNavs() {
  const { messages, isTyping, provider, model, ask, clear, changeProvider, changeModel, stop } = useNavs()
  const { data, isLoading: dataLoading, error: dataError, refresh } = useData()
  const greeting = useNavsGreeting()
  const suggestions = useNavsSuggestions('commandCenter')
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }
  
  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])
  
  // Focus input on mount and when data loads
  useEffect(() => {
    if (!dataLoading && inputRef.current) {
      inputRef.current.focus()
    }
  }, [dataLoading])
  
  const handleSend = async () => {
    if (!input.trim() || isTyping) return
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
  
  const handleSuggestionClick = async (suggestion: string) => {
    if (isTyping) return
    await ask(suggestion)
  }

  // Show loading state while data is loading or not yet available
  if (dataLoading || !data) {
    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col items-center justify-center">
        <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-dark)] flex items-center justify-center mb-4 animate-pulse">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <p className="text-[var(--color-text-muted)]">Loading dashboard data...</p>
      </div>
    )
  }

  // Show error state
  if (dataError) {
    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col items-center justify-center">
        <div className="h-16 w-16 rounded-xl bg-[var(--color-danger)]/20 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-[var(--color-danger)]" />
        </div>
        <p className="text-white mb-2">Unable to load data</p>
        <p className="text-[var(--color-text-muted)] mb-4">{dataError}</p>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent-primary)] text-white hover:bg-[var(--color-accent-glow)] transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }
  
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6 flex-shrink-0"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-dark)] flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[var(--color-success)] border-2 border-[var(--color-bg-base)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Ask Navs</h1>
            <p className="text-[var(--color-text-muted)]">
              {NAVS_PERSONA.title} • {NAVS_PERSONA.organization}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Model Switcher */}
          <ModelSwitcher
            currentProvider={provider}
            currentModel={model}
            onProviderChange={changeProvider}
            onModelChange={changeModel}
          />
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              showSettings 
                ? 'bg-[var(--color-bg-surface)] text-white' 
                : 'text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-surface)]'
            )}
          >
            <Settings className="h-5 w-5" />
          </button>
          <button
            onClick={clear}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-surface)] transition-colors"
            title="Clear conversation"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </motion.div>
      
      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 flex-shrink-0 overflow-hidden"
          >
            <GlassCard padding="sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[var(--color-text-muted)]">Current Model:</span>
                  <ProviderStatusIndicator provider={provider} model={model} />
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {data?.students?.length 
                    ? `${data.students.length.toLocaleString()} student records available for analysis`
                    : 'No student records available'
                  }
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0"
      >
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="pt-8 pb-12 px-4"
          >
            {/* Content wrapper with max width and centered */}
            <div className="max-w-3xl mx-auto text-center">
              {/* Avatar/Icon */}
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-dark)] flex items-center justify-center mb-8 shadow-lg shadow-[var(--color-accent-primary)]/20 mx-auto">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              
              {/* Greeting */}
              <h2 className="text-2xl font-semibold text-white mb-3">{greeting}</h2>
              <p className="text-[var(--color-text-muted)] mb-10 leading-relaxed">
                I'm Navs, your AI assistant for enrollment analytics. Ask me anything about applications, 
                NTR, programs, or trends. I can dig into the raw data for complex queries and remember 
                our conversation for follow-up questions.
              </p>
              
              {/* Data Status */}
              {data && (
                <div className="inline-flex text-xs text-[var(--color-text-muted)] mb-8 px-4 py-2 rounded-lg bg-[var(--color-bg-surface)]/50 border border-[var(--color-border-subtle)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                    {data.funnel?.length ? `${data.funnel[0].count.toLocaleString()} applications` : 'No data'}
                    {data.students?.length ? ` • ${data.students.length.toLocaleString()} student records` : ''}
                    <span className="text-[var(--color-text-muted)]/60">•</span>
                    Updated {new Date(data.lastUpdated).toLocaleDateString()}
                  </span>
                </div>
              )}
              
              {/* Suggestions */}
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Try asking:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(suggestion)}
                      disabled={isTyping}
                      className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-left hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-elevated)] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-white transition-colors">
                        {suggestion}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-5 py-4',
                    message.role === 'user'
                      ? 'bg-[var(--color-accent-primary)] text-white'
                      : 'bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-white'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--color-border-subtle)]">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-dark)] flex items-center justify-center">
                        <Sparkles className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-sm font-medium">Navs</span>
                      {message.provider && (
                        <span className="text-xs text-[var(--color-text-muted)]">
                          via {message.provider === 'gemini' ? 'Gemini' : 'Ollama'}
                        </span>
                      )}
                      {message.tier === 'tier2' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)]">
                          Deep Analysis
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Thinking Steps */}
                  {message.role === 'assistant' && message.thinkingSteps && message.thinkingSteps.length > 0 && (
                    <ThinkingSteps 
                      steps={message.thinkingSteps} 
                      tier={message.tier}
                      isProcessing={isTyping && index === messages.length - 1}
                      onStop={stop}
                    />
                  )}
                  
                  {message.content && (
                    <Markdown>{message.content}</Markdown>
                  )}
                  
                  {/* Show executed code for Tier 2 */}
                  {message.executedCode && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
                      <button
                        onClick={() => setExpandedCode(
                          expandedCode === message.id ? null : message.id
                        )}
                        className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-white transition-colors"
                      >
                        <Code className="h-3 w-3" />
                        <span>View analysis code</span>
                        <ChevronDown className={cn(
                          "h-3 w-3 transition-transform",
                          expandedCode === message.id && "rotate-180"
                        )} />
                      </button>
                      
                      <AnimatePresence>
                        {expandedCode === message.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <pre className="mt-2 p-3 rounded-lg bg-[var(--color-bg-base)] text-xs font-mono text-[var(--color-text-secondary)] overflow-x-auto">
                              {message.executedCode}
                            </pre>
                            {message.executionResult && (
                              <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                                Executed in {message.executionResult.duration}ms
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)] flex flex-wrap gap-2">
                      {message.suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionClick(s)}
                          disabled={isTyping}
                          className="px-3 py-1.5 rounded-full text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-base)] hover:text-white transition-colors disabled:opacity-50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            
            {/* Only show typing indicator if the last message doesn't already have thinking steps */}
            {isTyping && (() => {
              const lastMessage = messages[messages.length - 1]
              // Hide typing indicator if last message is assistant with thinking steps (it shows its own loading state)
              const hasThinkingSteps = lastMessage?.role === 'assistant' && lastMessage?.thinkingSteps && lastMessage.thinkingSteps.length > 0
              if (hasThinkingSteps) return null
              
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-2xl px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-dark)] flex items-center justify-center">
                        <Sparkles className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-sm font-medium text-white">Navs</span>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )
            })()}
            
            <div ref={messagesEndRef} className="h-4" />
          </>
        )}
      </div>
      
      {/* Input Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-4 pt-4 border-t border-[var(--color-border-subtle)] flex-shrink-0"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] focus-within:border-[var(--color-accent-primary)] focus-within:ring-2 focus-within:ring-[var(--color-accent-primary)]/20 transition-all">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about enrollment data..."
              disabled={isTyping}
              className="flex-1 bg-transparent px-4 py-4 text-white placeholder:text-[var(--color-text-muted)] focus:outline-none disabled:opacity-50"
            />
            
            {/* Stop button (shown while typing) */}
            {isTyping && (
              <button
                onClick={stop}
                className="flex h-10 items-center gap-2 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-warning)] hover:border-[var(--color-warning)] transition-colors"
              >
                <Square className="h-4 w-4" />
                <span className="text-sm">Stop</span>
              </button>
            )}
            
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent-primary)] text-white mr-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-accent-glow)] transition-colors"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <p className="text-xs text-[var(--color-text-muted)] text-center mt-3">
          Navs can dig into {data?.students?.length?.toLocaleString() || 0} student records for complex queries. 
          Verify important data with the source.
        </p>
      </motion.div>
    </div>
  )
}
