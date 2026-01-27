import { useState } from 'react'
import { motion } from 'framer-motion'
import { Send, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNavs, useNavsSuggestions } from '@/hooks/useNavs'
import { cn } from '@/lib/utils'

interface NavsInputProps {
  context?: 'commandCenter' | 'revenue' | 'pipeline' | 'segment' | 'student' | 'time'
  placeholder?: string
  className?: string
}

export function NavsInput({ 
  context = 'commandCenter', 
  placeholder = 'Ask Navs anything about your enrollment data...',
  className 
}: NavsInputProps) {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const { ask, isTyping } = useNavs()
  const suggestions = useNavsSuggestions(context)
  const navigate = useNavigate()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isTyping) return
    
    const question = input
    setInput('')
    
    // Navigate to Ask Navs page and ask the question
    navigate('/ask-navs')
    await ask(question)
  }
  
  const handleSuggestionClick = async (suggestion: string) => {
    navigate('/ask-navs')
    await ask(suggestion)
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={cn('glass-card p-6', className)}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-[var(--color-accent-primary)]" />
        <h3 className="font-semibold text-white">Ask Navs</h3>
      </div>
      
      {/* Input Form */}
      <form onSubmit={handleSubmit}>
        <div className={cn(
          'flex items-center gap-3 rounded-xl border bg-[var(--color-bg-elevated)] transition-all',
          isFocused 
            ? 'border-[var(--color-accent-primary)] ring-2 ring-[var(--color-accent-primary)]/20' 
            : 'border-[var(--color-border-subtle)]'
        )}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={isTyping}
            className="flex-1 bg-transparent px-4 py-3 text-white placeholder:text-[var(--color-text-muted)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent-primary)] text-white mr-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-accent-glow)] transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
      
      {/* Suggestions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => handleSuggestionClick(suggestion)}
            className="px-3 py-1.5 rounded-full text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-accent-primary)] hover:text-white transition-all"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </motion.div>
  )
}
