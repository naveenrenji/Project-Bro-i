/**
 * ModelSwitcher Component
 * UI for switching between cloud (Gemini) and local (Ollama) LLM providers
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Cloud, 
  Server, 
  ChevronDown, 
  Check, 
  AlertCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  type ProviderType, 
  type ProviderStatus,
  checkProviderStatus,
  getModelDisplayName,
  DEFAULT_GEMINI_MODEL
} from '@/lib/llm-provider'

// =============================================================================
// TYPES
// =============================================================================

interface ModelSwitcherProps {
  currentProvider: ProviderType
  currentModel: string
  onProviderChange: (provider: ProviderType) => void
  onModelChange: (model: string) => void
  compact?: boolean
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ModelSwitcher({
  currentProvider,
  currentModel,
  onProviderChange,
  onModelChange,
  compact = false
}: ModelSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<ProviderStatus | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  
  // Check provider availability on mount
  useEffect(() => {
    checkStatus()
  }, [])
  
  const checkStatus = async () => {
    setIsChecking(true)
    try {
      const newStatus = await checkProviderStatus()
      setStatus(newStatus)
    } catch (error) {
      console.error('Failed to check provider status:', error)
    } finally {
      setIsChecking(false)
    }
  }
  
  const handleProviderSelect = (provider: ProviderType) => {
    onProviderChange(provider)
    
    // Auto-select first available model for the provider
    if (provider === 'gemini') {
      onModelChange(DEFAULT_GEMINI_MODEL)
    } else if (provider === 'ollama' && status?.ollama.models.length) {
      onModelChange(status.ollama.models[0])
    }
    
    setIsOpen(false)
  }
  
  const handleModelSelect = (model: string) => {
    onModelChange(model)
    setIsOpen(false)
  }
  
  const isGeminiAvailable = status?.gemini.available ?? false
  const isOllamaAvailable = status?.ollama.available ?? false
  const ollamaModels = status?.ollama.models ?? []
  
  // Compact mode for inline display
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-md",
          currentProvider === 'gemini' 
            ? "bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]"
            : "bg-[var(--color-success)]/10 text-[var(--color-success)]"
        )}>
          {currentProvider === 'gemini' ? (
            <Cloud className="h-3 w-3" />
          ) : (
            <Server className="h-3 w-3" />
          )}
          <span>{getModelDisplayName(currentModel)}</span>
        </div>
      </div>
    )
  }
  
  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] transition-colors text-sm"
      >
        {currentProvider === 'gemini' ? (
          <Cloud className="h-4 w-4 text-[var(--color-accent-primary)]" />
        ) : (
          <Server className="h-4 w-4 text-[var(--color-success)]" />
        )}
        
        <span className="text-[var(--color-text-primary)]">
          {getModelDisplayName(currentModel)}
        </span>
        
        <ChevronDown className={cn(
          "h-4 w-4 text-[var(--color-text-muted)] transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>
      
      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 mt-2 w-72 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] shadow-xl z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)]">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  Select Model
                </span>
                <button
                  onClick={checkStatus}
                  disabled={isChecking}
                  className="p-1 rounded hover:bg-[var(--color-bg-elevated)] transition-colors"
                  title="Refresh status"
                >
                  <RefreshCw className={cn(
                    "h-4 w-4 text-[var(--color-text-muted)]",
                    isChecking && "animate-spin"
                  )} />
                </button>
              </div>
              
              {/* Cloud Provider */}
              <div className="p-2">
                <div className="px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                  Cloud
                </div>
                
                <button
                  onClick={() => handleProviderSelect('gemini')}
                  disabled={!isGeminiAvailable}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    currentProvider === 'gemini' && currentModel === DEFAULT_GEMINI_MODEL
                      ? "bg-[var(--color-accent-primary)]/10"
                      : "hover:bg-[var(--color-bg-elevated)]",
                    !isGeminiAvailable && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Cloud className={cn(
                    "h-5 w-5",
                    isGeminiAvailable 
                      ? "text-[var(--color-accent-primary)]" 
                      : "text-[var(--color-text-muted)]"
                  )} />
                  
                  <div className="flex-1 text-left">
                    <div className="text-sm text-[var(--color-text-primary)]">
                      Gemini 2.0 Flash
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      Google Cloud API
                    </div>
                  </div>
                  
                  {isGeminiAvailable ? (
                    currentProvider === 'gemini' && (
                      <Check className="h-4 w-4 text-[var(--color-accent-primary)]" />
                    )
                  ) : (
                    <AlertCircle className="h-4 w-4 text-[var(--color-warning)]" />
                  )}
                </button>
                
                {!isGeminiAvailable && (
                  <p className="px-3 py-1 text-xs text-[var(--color-warning)]">
                    API key not configured
                  </p>
                )}
              </div>
              
              {/* Local Provider */}
              <div className="p-2 border-t border-[var(--color-border-subtle)]">
                <div className="px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                  Local (Ollama)
                </div>
                
                {isOllamaAvailable ? (
                  ollamaModels.length > 0 ? (
                    <div className="space-y-1">
                      {ollamaModels.map(model => (
                        <button
                          key={model}
                          onClick={() => {
                            onProviderChange('ollama')
                            handleModelSelect(model)
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                            currentProvider === 'ollama' && currentModel === model
                              ? "bg-[var(--color-success)]/10"
                              : "hover:bg-[var(--color-bg-elevated)]"
                          )}
                        >
                          <Server className="h-5 w-5 text-[var(--color-success)]" />
                          
                          <div className="flex-1 text-left">
                            <div className="text-sm text-[var(--color-text-primary)]">
                              {getModelDisplayName(model)}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              {model}
                            </div>
                          </div>
                          
                          {currentProvider === 'ollama' && currentModel === model && (
                            <Check className="h-4 w-4 text-[var(--color-success)]" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-center">
                      <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                        No supported models installed
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Install with: <code className="bg-[var(--color-bg-base)] px-1 rounded">ollama pull qwen3</code>
                      </p>
                    </div>
                  )
                ) : (
                  <div className="px-3 py-4">
                    <div className="flex items-start gap-2 text-[var(--color-warning)]">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Ollama not detected</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          To use local models:
                        </p>
                        <ol className="text-xs text-[var(--color-text-muted)] mt-1 space-y-1 list-decimal list-inside">
                          <li>Install Ollama</li>
                          <li>Run: <code className="bg-[var(--color-bg-base)] px-1 rounded">ollama pull qwen3:14b</code></li>
                          <li>Start: <code className="bg-[var(--color-bg-base)] px-1 rounded">ollama serve</code></li>
                        </ol>
                        <a
                          href="https://ollama.ai"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[var(--color-accent-primary)] mt-2 hover:underline"
                        >
                          Get Ollama <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Status Footer */}
              <div className="px-4 py-2 bg-[var(--color-bg-base)] border-t border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      isGeminiAvailable ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]"
                    )} />
                    <span>Gemini</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      isOllamaAvailable ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]"
                    )} />
                    <span>Ollama</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// =============================================================================
// COMPACT STATUS INDICATOR
// =============================================================================

interface ProviderStatusIndicatorProps {
  provider: ProviderType
  model: string
}

export function ProviderStatusIndicator({ provider, model }: ProviderStatusIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {provider === 'gemini' ? (
        <>
          <Cloud className="h-3 w-3 text-[var(--color-accent-primary)]" />
          <span className="text-[var(--color-text-muted)]">Cloud</span>
        </>
      ) : (
        <>
          <Server className="h-3 w-3 text-[var(--color-success)]" />
          <span className="text-[var(--color-text-muted)]">Local</span>
        </>
      )}
      <span className="text-[var(--color-text-secondary)]">
        {getModelDisplayName(model)}
      </span>
    </div>
  )
}
