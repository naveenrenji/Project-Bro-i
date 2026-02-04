/**
 * ThinkingSteps Component
 * Displays the AI's reasoning process with human-readable thinking
 * and expandable details for code, inputs, outputs, and LLM reasoning
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronDown, 
  ChevronRight, 
  Check, 
  Loader2, 
  AlertCircle,
  Brain,
  Search,
  Code,
  Cpu,
  FileText,
  Sparkles,
  Square
} from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

export type StepType = 
  | 'analyzing' 
  | 'searchingContext' 
  | 'foundInContext'
  | 'needsDeepDive' 
  | 'generatingCode' 
  | 'executingCode' 
  | 'formattingResult' 
  | 'complete' 
  | 'error'
  | 'stopped'

export type StepStatus = 'pending' | 'active' | 'complete' | 'error' | 'stopped'

export interface ThinkingStepExpandable {
  code?: string           // Generated analysis code
  input?: string          // What data is being analyzed
  output?: string         // Result summary
  error?: string          // If something failed
  llmReasoning?: string   // DeepSeek R1 <think> tag content
}

export interface ThinkingStep {
  id: string
  type: StepType
  status: StepStatus
  title: string           // Short label: "Checking my data..."
  thinking?: string       // Navs thinking out loud (shown inline)
  timestamp: Date
  duration?: number
  expandable?: ThinkingStepExpandable
}

interface ThinkingStepsProps {
  steps: ThinkingStep[]
  isExpanded?: boolean
  onToggleExpand?: () => void
  tier?: 'tier1' | 'tier2'
  onStop?: () => void     // Callback for stop button
  isProcessing?: boolean  // Show stop option when processing
}

// =============================================================================
// STEP ICONS
// =============================================================================

const stepIcons: Record<StepType, typeof Brain> = {
  analyzing: Brain,
  searchingContext: Search,
  foundInContext: Check,
  needsDeepDive: Sparkles,
  generatingCode: Code,
  executingCode: Cpu,
  formattingResult: FileText,
  complete: Check,
  error: AlertCircle,
  stopped: Square,
}

// =============================================================================
// EXPANDABLE SECTION COMPONENT
// =============================================================================

interface ExpandableSectionProps {
  label: string
  content: string
  isCode?: boolean
  icon?: typeof Code
}

function ExpandableSection({ label, content, isCode, icon: Icon }: ExpandableSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <ChevronDown className={cn(
          "h-3 w-3 transition-transform",
          !isOpen && "-rotate-90"
        )} />
        {Icon && <Icon className="h-3 w-3" />}
        <span>{label}</span>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className={cn(
              "mt-2 p-3 rounded-lg border border-[var(--color-border-subtle)]",
              isCode ? "bg-[var(--color-bg-base)]" : "bg-[var(--color-bg-elevated)]"
            )}>
              <pre className={cn(
                "text-xs whitespace-pre-wrap overflow-x-auto",
                isCode 
                  ? "font-mono text-[var(--color-text-secondary)]" 
                  : "text-[var(--color-text-secondary)] font-sans"
              )}>
                {content}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ThinkingSteps({ 
  steps, 
  isExpanded: initialExpanded = true, // Default expanded to show thinking
  onToggleExpand,
  tier,
  onStop,
  isProcessing
}: ThinkingStepsProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded)
  
  const hasSteps = steps.length > 0
  const isComplete = steps.some(s => s.type === 'complete')
  const hasError = steps.some(s => s.status === 'error')
  const wasStopped = steps.some(s => s.status === 'stopped')
  const totalDuration = steps.reduce((acc, s) => acc + (s.duration || 0), 0)
  
  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
    onToggleExpand?.()
  }
  
  if (!hasSteps) return null
  
  return (
    <div className="mb-3">
      {/* Compact Summary Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggleExpand}
          className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors flex-1"
        >
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="h-3 w-3" />
          </motion.div>
          
          <Brain className="h-3 w-3" />
          
          <span>
            {wasStopped ? (
              'Stopped by user'
            ) : isComplete ? (
              tier === 'tier2' 
                ? `Analyzed in ${steps.length} steps (${(totalDuration / 1000).toFixed(1)}s)`
                : `Found in context (${(totalDuration / 1000).toFixed(1)}s)`
            ) : hasError ? (
              'Ran into an issue...'
            ) : (
              'Thinking...'
            )}
          </span>
          
          {!isComplete && !hasError && !wasStopped && (
            <Loader2 className="h-3 w-3 animate-spin ml-auto" />
          )}
          
          {isComplete && (
            <Check className="h-3 w-3 text-[var(--color-success)] ml-auto" />
          )}
          
          {hasError && (
            <AlertCircle className="h-3 w-3 text-[var(--color-warning)] ml-auto" />
          )}
          
          {wasStopped && (
            <Square className="h-3 w-3 text-[var(--color-text-muted)] ml-auto" />
          )}
        </button>
        
        {/* Inline Stop Button */}
        {isProcessing && onStop && (
          <button
            onClick={onStop}
            className="px-2 py-1 text-xs rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-warning)] hover:border-[var(--color-warning)] transition-colors flex items-center gap-1"
          >
            <Square className="h-3 w-3" />
            Stop
          </button>
        )}
      </div>
      
      {/* Expanded Steps */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3">
              {steps.map((step, index) => {
                const Icon = stepIcons[step.type] || Brain
                const hasExpandable = step.expandable && (
                  step.expandable.code || 
                  step.expandable.input || 
                  step.expandable.output || 
                  step.expandable.llmReasoning
                )
                
                return (
                  <div 
                    key={step.id} 
                    className={cn(
                      "pl-4 border-l-2 transition-colors",
                      step.status === 'active' && "border-[var(--color-accent-primary)]",
                      step.status === 'complete' && "border-[var(--color-success)]",
                      step.status === 'error' && "border-[var(--color-warning)]",
                      step.status === 'stopped' && "border-[var(--color-text-muted)]",
                      step.status === 'pending' && "border-[var(--color-border-subtle)]"
                    )}
                  >
                    {/* Step Header */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className={cn(
                        "flex items-center gap-1.5 font-medium",
                        step.status === 'active' && "text-[var(--color-accent-primary)]",
                        step.status === 'complete' && "text-[var(--color-text-primary)]",
                        step.status === 'error' && "text-[var(--color-warning)]",
                        step.status === 'stopped' && "text-[var(--color-text-muted)]",
                        step.status === 'pending' && "text-[var(--color-text-muted)]"
                      )}>
                        {step.status === 'active' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                        <span>[{index + 1}]</span>
                        <span>{step.title}</span>
                      </span>
                      
                      {step.status === 'complete' && (
                        <Check className="h-3 w-3 text-[var(--color-success)]" />
                      )}
                      
                      {step.duration !== undefined && step.status === 'complete' && (
                        <span className="text-[var(--color-text-muted)] ml-auto">
                          {step.duration < 1000 
                            ? `${step.duration}ms` 
                            : `${(step.duration / 1000).toFixed(1)}s`}
                        </span>
                      )}
                    </div>
                    
                    {/* Thinking Text (inline, always visible when present) */}
                    {step.thinking && (
                      <p className={cn(
                        "mt-1.5 text-sm leading-relaxed pl-5",
                        step.status === 'active' 
                          ? "text-[var(--color-text-secondary)]" 
                          : "text-[var(--color-text-muted)]"
                      )}>
                        "{step.thinking}"
                      </p>
                    )}
                    
                    {/* Expandable Sections */}
                    {hasExpandable && (
                      <div className="pl-5 mt-2">
                        {/* LLM Reasoning (DeepSeek R1) */}
                        {step.expandable?.llmReasoning && (
                          <ExpandableSection
                            label="Model reasoning"
                            content={step.expandable.llmReasoning}
                            icon={Brain}
                          />
                        )}
                        
                        {/* Generated Code */}
                        {step.expandable?.code && (
                          <ExpandableSection
                            label="View code"
                            content={step.expandable.code}
                            isCode
                            icon={Code}
                          />
                        )}
                        
                        {/* Input Summary */}
                        {step.expandable?.input && (
                          <ExpandableSection
                            label="Input"
                            content={step.expandable.input}
                            icon={FileText}
                          />
                        )}
                        
                        {/* Output/Result */}
                        {step.expandable?.output && (
                          <ExpandableSection
                            label="Output"
                            content={step.expandable.output}
                            isCode
                            icon={Cpu}
                          />
                        )}
                        
                        {/* Error */}
                        {step.expandable?.error && (
                          <div className="mt-2 p-2 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20">
                            <p className="text-xs text-[var(--color-warning)]">
                              {step.expandable.error}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

let stepCounter = 0

export function createStep(
  type: StepType,
  title: string,
  options?: { 
    thinking?: string
    expandable?: ThinkingStepExpandable 
  }
): ThinkingStep {
  return {
    id: `step-${++stepCounter}-${Date.now()}`,
    type,
    status: 'pending',
    title,
    thinking: options?.thinking,
    expandable: options?.expandable,
    timestamp: new Date(),
  }
}

export function updateStepStatus(
  steps: ThinkingStep[],
  stepId: string,
  status: StepStatus,
  duration?: number
): ThinkingStep[] {
  return steps.map(step => 
    step.id === stepId 
      ? { ...step, status, duration } 
      : step
  )
}

export function updateStepThinking(
  steps: ThinkingStep[],
  stepId: string,
  thinking: string
): ThinkingStep[] {
  return steps.map(step => 
    step.id === stepId 
      ? { ...step, thinking } 
      : step
  )
}

export function updateStepExpandable(
  steps: ThinkingStep[],
  stepId: string,
  expandable: Partial<ThinkingStepExpandable>
): ThinkingStep[] {
  return steps.map(step => 
    step.id === stepId 
      ? { ...step, expandable: { ...step.expandable, ...expandable } } 
      : step
  )
}
