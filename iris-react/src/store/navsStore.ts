/**
 * Navs Store - Two-Tier AI Response System
 * Supports both cloud (Gemini) and local (Ollama) LLM providers
 * with intelligent fallback to code execution for complex queries
 * Enhanced with:
 * - Human-readable thinking steps
 * - Abort control
 * - Knowledge base with 15-day TTL per entry
 * - Semantic similarity search
 * - Reference detection and context injection
 * - Parallel follow-up pre-computation
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useDataStore, type DashboardData, type StudentRecord } from './dataStore'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { 
  type ProviderType, 
  generateWithProvider,
  isAbortError,
  DEFAULT_GEMINI_MODEL,
  getModelFamily,
  generateEmbedding
} from '@/lib/llm-provider'
import { 
  buildTier1Prompt, 
  buildTier2Prompt, 
  buildFormattingPrompt,
  ERROR_MESSAGES
} from '@/lib/navs-prompts'
import { 
  parseTier1Response, 
  needsTier2Fallback, 
  extractCodeBlock,
  extractR1Reasoning,
  generateThinkingSummary
} from '@/lib/code-utils'
import { executeInSandbox, validateCode } from '@/lib/code-sandbox'
import type { ThinkingStep, StepType, StepStatus, ThinkingStepExpandable } from '@/components/navs/ThinkingSteps'

// Knowledge base and similarity search
import { 
  addKnowledgeEntry, 
  getAllKnowledgeEntries,
  type ComputedData,
} from '@/lib/indexed-db'
import { 
  findCachedAnswer, 
  detectReferences, 
  findRelevantContext,
  injectPreviousContext 
} from '@/lib/similarity'
import { runBackgroundPrecomputation } from '@/lib/follow-up-engine'

// =============================================================================
// TYPES
// =============================================================================

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  model?: string
  provider?: ProviderType
  charts?: Array<{
    type: string
    data: unknown
    title: string
  }>
  suggestions?: string[]
  thinkingSteps?: ThinkingStep[]
  executedCode?: string
  executionResult?: {
    success: boolean
    result?: unknown
    error?: string
    duration: number
  }
  tier?: 'tier1' | 'tier2'
}

export interface AnalysisResult {
  question: string
  answer: unknown
  explanation?: string
  code?: string
  timestamp: Date
}

export interface NavsState {
  // Chat
  messages: ChatMessage[]
  isTyping: boolean
  
  // LLM Provider
  provider: ProviderType
  model: string
  
  // Abort control
  abortController: AbortController | null
  
  // Analysis cache for context
  analysisCache: AnalysisResult[]
  
  // Context
  currentPage: string
  selectedContext: string[]
  
  // History
  conversationSummary: string | null
  
  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  setTyping: (isTyping: boolean) => void
  setProvider: (provider: ProviderType) => void
  setModel: (model: string) => void
  setCurrentPage: (page: string) => void
  setSelectedContext: (context: string[]) => void
  setSummary: (summary: string | null) => void
  clearMessages: () => void
  stopGeneration: () => void
  sendMessage: (content: string) => Promise<void>
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

let stepCounter = 0

function createStep(
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
    status: 'active' as StepStatus,
    title,
    thinking: options?.thinking,
    expandable: options?.expandable,
    timestamp: new Date(),
  }
}

// Reserved for future use
function _updateStepInArray(
  steps: ThinkingStep[],
  stepId: string,
  updates: Partial<ThinkingStep>
): ThinkingStep[] {
  return steps.map(step => 
    step.id === stepId ? { ...step, ...updates } : step
  )
}
void _updateStepInArray // suppress unused warning

// Infer computed data structure from execution result
function inferComputedData(
  question: string, 
  result: { answer: unknown; explanation?: string } | null
): ComputedData {
  if (!result || result.answer === undefined) {
    return { type: 'unknown', entities: [], values: {} }
  }
  
  const answer = result.answer
  const q = question.toLowerCase()
  
  // Determine type based on question and result
  let type: ComputedData['type'] = 'unknown'
  let entities: string[] = []
  let values: Record<string, unknown> = {}
  
  // Check if answer is an array (list type)
  if (Array.isArray(answer)) {
    type = 'list'
    // Try to extract entity names from array
    entities = answer.slice(0, 20).map(item => {
      if (typeof item === 'string') return item
      if (typeof item === 'object' && item !== null) {
        // Look for common name fields
        const obj = item as Record<string, unknown>
        return String(obj.name || obj.state || obj.program || obj.school || obj.category || Object.values(obj)[0] || '')
      }
      return String(item)
    }).filter(Boolean)
    
    // Try to build values from array
    answer.slice(0, 10).forEach((item, i) => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>
        const name = String(obj.name || obj.state || obj.program || obj.school || `item_${i}`)
        const value = obj.count || obj.total || obj.value || obj.students || obj.ntr
        if (value !== undefined) {
          values[name] = value
        }
      }
    })
  }
  // Check if answer is a number (count or aggregation)
  else if (typeof answer === 'number') {
    if (q.includes('how many') || q.includes('count') || q.includes('number of')) {
      type = 'count'
    } else {
      type = 'aggregation'
    }
    values = { result: answer }
  }
  // Check if answer is an object
  else if (typeof answer === 'object' && answer !== null) {
    const obj = answer as Record<string, unknown>
    
    if (q.includes('compare') || q.includes('vs') || q.includes('versus')) {
      type = 'comparison'
    } else if (q.includes('breakdown') || q.includes('by category')) {
      type = 'aggregation'
    } else {
      type = 'aggregation'
    }
    
    // Extract entities from object keys
    entities = Object.keys(obj).slice(0, 20)
    values = obj
  }
  // String answer
  else if (typeof answer === 'string') {
    type = 'unknown'
    values = { result: answer }
  }
  
  return { type, entities, values }
}

// Detect question type for thinking summary
function analyzeQuestion(question: string): string {
  const q = question.toLowerCase()
  
  if (q.includes('percentage') || q.includes('percent') || q.includes('%')) {
    return `You're asking for a percentage calculation...`
  }
  if (q.includes('how many') || q.includes('count') || q.includes('number of')) {
    return `You want to know a count...`
  }
  if (q.includes('compare') || q.includes('vs') || q.includes('versus')) {
    return `You're looking for a comparison...`
  }
  if (q.includes('trend') || q.includes('over time') || q.includes('yoy')) {
    return `You want to see a trend analysis...`
  }
  if (q.includes('top') || q.includes('best') || q.includes('highest')) {
    return `You want to find the top performers...`
  }
  if (q.includes('breakdown') || q.includes('by category') || q.includes('split')) {
    return `You want a breakdown by category...`
  }
  
  return `Let me understand what you're looking for...`
}

// Build context from dashboard data
function buildContext(data: DashboardData | null, analysisCache: AnalysisResult[] = []): string {
  if (!data) return 'Dashboard data is currently unavailable.'
  
  const lines: string[] = []
  
  // Summary
  lines.push('=== CURRENT DATA CONTEXT ===')
  lines.push('')
  
  // Funnel Summary
  lines.push('## Enrollment Funnel (Spring 2026)')
  if (data.funnel?.length) {
    for (const stage of data.funnel) {
      lines.push(`- ${stage.stage}: ${formatNumber(stage.count)} (${stage.conversionRate}% conversion)`)
    }
  }
  lines.push('')
  
  // NTR Summary
  if (data.ntr) {
    lines.push('## NTR (Net Tuition Revenue)')
    lines.push(`- Total NTR: ${formatCurrency(data.ntr.total)}`)
    lines.push(`- Goal: ${formatCurrency(data.ntr.goal)}`)
    lines.push(`- Progress: ${data.ntr.percentOfGoal?.toFixed(1) || ((data.ntr.total / data.ntr.goal) * 100).toFixed(1)}% of goal`)
    lines.push(`- Gap to Goal: ${formatCurrency(data.ntr.gapToGoal || (data.ntr.goal - data.ntr.total))}`)
    lines.push(`- New Student NTR: ${formatCurrency(data.ntr.newNTR)}`)
    lines.push(`- Current Student NTR: ${formatCurrency(data.ntr.currentNTR)}`)
    lines.push(`- Total Students: ${formatNumber(data.ntr.totalStudents || 0)}`)
    lines.push(`- Total Credits: ${formatNumber(data.ntr.totalCredits || 0)}`)
    lines.push('')
    
    if (data.ntr.byCategory?.length) {
      lines.push('### NTR by Category:')
      for (const cat of data.ntr.byCategory.slice(0, 8)) {
        lines.push(`- ${cat.category} (${cat.degreeType}): ${formatCurrency(cat.ntr)} (${cat.students} students)`)
      }
      lines.push('')
    }
  }
  
  // Enrollment Breakdown
  if (data.enrollmentBreakdown) {
    lines.push('## Enrollment Breakdown')
    lines.push(`- New (from Slate): ${formatNumber(data.enrollmentBreakdown.newSlate)}`)
    lines.push(`- Continuing: ${formatNumber(data.enrollmentBreakdown.continuing)}`)
    lines.push(`- Returning: ${formatNumber(data.enrollmentBreakdown.returning)}`)
    lines.push(`- Total: ${formatNumber(data.enrollmentBreakdown.total)}`)
    lines.push('')
  }
  
  // YoY Comparison
  if (data.yoy) {
    lines.push('## Year-over-Year Comparison (2026 vs 2025)')
    lines.push(`- Applications: ${data.yoy.vsLastYear.appsChange > 0 ? '+' : ''}${data.yoy.vsLastYear.appsChange}%`)
    lines.push(`- Admits: ${data.yoy.vsLastYear.admitsChange > 0 ? '+' : ''}${data.yoy.vsLastYear.admitsChange}%`)
    lines.push(`- Enrollments: ${data.yoy.vsLastYear.enrollmentsChange > 0 ? '+' : ''}${data.yoy.vsLastYear.enrollmentsChange}%`)
    lines.push(`- Yield Change: ${data.yoy.vsLastYear.yieldChange > 0 ? '+' : ''}${data.yoy.vsLastYear.yieldChange} points`)
    lines.push('')
  }
  
  // Categories
  if (data.categories?.length) {
    lines.push('## Performance by Category')
    for (const cat of data.categories) {
      lines.push(`- ${cat.category}: ${cat.applications} apps, ${cat.admits} admits, ${cat.enrollments} enrolled, ${cat.yield}% yield`)
    }
    lines.push('')
  }
  
  // Top Programs
  if (data.programs?.length) {
    lines.push('## Top Programs (by enrollments)')
    for (const prog of data.programs.slice(0, 10)) {
      const yoyStr = prog.yoyChange ? ` (${prog.yoyChange > 0 ? '+' : ''}${prog.yoyChange}% YoY)` : ''
      lines.push(`- ${prog.program} (${prog.school}): ${prog.enrollments} enrolled, ${prog.yield}% yield${yoyStr}`)
    }
    lines.push('')
  }
  
  // Corporate Cohorts
  if (data.cohorts?.length) {
    lines.push('## Corporate Cohorts (top companies)')
    for (const cohort of data.cohorts.slice(0, 5)) {
      lines.push(`- ${cohort.company}: ${cohort.enrollments} enrolled (${cohort.newStudents} new, ${cohort.continuingStudents} continuing)`)
    }
    lines.push('')
  }
  
  // Graduation Tracking
  if (data.graduation) {
    lines.push('## Graduation Tracking')
    lines.push(`- Graduating This Term: ${formatNumber(data.graduation.graduatingThisTerm)}`)
    lines.push(`- Within 10 Credits: ${formatNumber(data.graduation.within10Credits)}`)
    lines.push(`- Within 20 Credits: ${formatNumber(data.graduation.within20Credits || 0)}`)
    lines.push(`- 20+ Credits Remaining: ${formatNumber(data.graduation.credits20Plus)}`)
    lines.push(`- Total Students: ${formatNumber(data.graduation.totalStudents || 0)}`)
    lines.push('')
  }
  
  // School Breakdown
  if (data.bySchool?.length) {
    lines.push('## By School')
    for (const school of data.bySchool) {
      lines.push(`- ${school.school}: ${school.enrollments} enrolled, ${school.yield}% yield`)
    }
    lines.push('')
  }
  
  // Historical
  if (data.historical) {
    lines.push('## Historical Trend')
    for (let i = 0; i < data.historical.years.length; i++) {
      lines.push(`- ${data.historical.years[i]}: ${data.historical.applications[i]} apps, ${data.historical.admits[i]} admits, ${data.historical.enrollments[i]} enrolled`)
    }
    lines.push('')
  }
  
  // Include recent analysis results
  if (analysisCache.length > 0) {
    lines.push('## Recent Analysis Results')
    for (const analysis of analysisCache.slice(-5)) {
      lines.push(`- Q: "${analysis.question}" → A: ${JSON.stringify(analysis.answer)}`)
    }
    lines.push('')
  }
  
  lines.push('=== END OF DATA CONTEXT ===')
  lines.push('')
  lines.push('DATA LIMITS: There is no program-level NTR or cohort-level NTR. Do not invent numbers.')
  
  return lines.join('\n')
}

// Generate follow-up suggestions
function generateSuggestions(question: string): string[] {
  const q = question.toLowerCase()
  
  if (q.includes('ntr') || q.includes('revenue')) {
    return [
      'Break down NTR by student type',
      'Which categories drive the most NTR?',
      'How can we close the gap to goal?',
    ]
  }
  
  if (q.includes('graduat')) {
    return [
      'How many students are graduating by category?',
      'What is the projected retention rate?',
      'How does graduation impact next term NTR?',
    ]
  }
  
  if (q.includes('yield')) {
    return [
      'Which programs have the best yield?',
      'How does yield compare to last year?',
      'What can we do to improve retail yield?',
    ]
  }
  
  if (q.includes('program') || q.includes('enroll')) {
    return [
      'Show YoY comparison for top programs',
      'Which programs are declining?',
      'Compare programs by yield rate',
    ]
  }
  
  if (q.includes('corporate') || q.includes('cohort') || q.includes('international')) {
    return [
      'Which companies have the most students?',
      'How are corporate cohorts performing?',
      'New vs continuing corporate students',
    ]
  }
  
  return [
    'How are we tracking against NTR goal?',
    'What should I project for next term?',
    'Which programs need attention?',
  ]
}

// =============================================================================
// STORE
// =============================================================================

export const useNavsStore = create<NavsState>()(
  persist(
    (set, get) => ({
      messages: [],
      isTyping: false,
      provider: 'gemini',
      model: DEFAULT_GEMINI_MODEL,
      abortController: null,
      analysisCache: [],
      currentPage: 'command-center',
      selectedContext: [],
      conversationSummary: null,
      
      addMessage: (message) => {
        const newMessage: ChatMessage = {
          ...message,
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date(),
        }
        set((state) => ({
          messages: [...state.messages, newMessage],
        }))
        return newMessage.id
      },
      
      updateMessage: (id, updates) => {
        set((state) => ({
          messages: state.messages.map(msg =>
            msg.id === id ? { ...msg, ...updates } : msg
          ),
        }))
      },
      
      setTyping: (isTyping) => set({ isTyping }),
      setProvider: (provider) => set({ provider }),
      setModel: (model) => set({ model }),
      setCurrentPage: (currentPage) => set({ currentPage }),
      setSelectedContext: (selectedContext) => set({ selectedContext }),
      setSummary: (conversationSummary) => set({ conversationSummary }),
      
      clearMessages: () => set({ 
        messages: [], 
        conversationSummary: null,
        analysisCache: []
      }),
      
      stopGeneration: () => {
        const { abortController } = get()
        if (abortController) {
          abortController.abort()
          set({ abortController: null })
        }
      },
      
      /**
       * Send a message using the two-tier AI response system
       * Enhanced with knowledge base caching and similarity search
       */
      sendMessage: async (content) => {
        const { addMessage, updateMessage, setTyping: _setTyping, messages, provider, model, analysisCache } = get()
        void _setTyping // suppress unused warning
        
        // Create abort controller for this request
        const abortController = new AbortController()
        set({ abortController })
        
        // Add user message
        addMessage({ role: 'user', content })
        
        // Create placeholder for assistant message
        const steps: ThinkingStep[] = []
        const assistantMsgId = Math.random().toString(36).substring(2, 9)
        const isR1Model = getModelFamily(model) === 'deepseek-r1'
        
        set((state) => ({
          messages: [...state.messages, {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            provider,
            model,
            thinkingSteps: steps,
          }],
          isTyping: true,
        }))
        
        const updateSteps = (newSteps: ThinkingStep[]) => {
          updateMessage(assistantMsgId, { thinkingSteps: [...newSteps] })
        }
        
        try {
          // Get dashboard data
          const data = useDataStore.getState().data
          const context = buildContext(data, analysisCache)
          const students = data?.students || []
          
          // =================================================================
          // STEP 0: Check Knowledge Base for cached answer
          // =================================================================
          const step0 = createStep('searchingContext', 'Checking my memory...', {
            thinking: 'Looking for similar questions I\'ve answered before...'
          })
          steps.push(step0)
          updateSteps(steps)
          
          const cacheStart = Date.now()
          let enrichedContent = content
          let usedCache = false
          
          try {
            // Check for similar cached answers
            const cached = await findCachedAnswer(content, 0.88)
            
            if (cached) {
              // Cache hit! Return cached answer
              steps[0] = {
                ...steps[0],
                status: 'complete',
                duration: Date.now() - cacheStart,
                thinking: `Found a similar question from my memory! (${Math.round(cached.similarity * 100)}% match)`,
                expandable: {
                  input: `Matched: "${cached.entry.question}"`,
                  output: `Using cached answer from ${new Date(cached.entry.createdAt).toLocaleDateString()}`
                }
              }
              updateSteps(steps)
              
              // Mark as complete with cached answer
              const stepComplete = createStep('complete', 'Retrieved from memory!')
              stepComplete.status = 'complete'
              steps.push(stepComplete)
              updateSteps(steps)
              
              updateMessage(assistantMsgId, {
                content: cached.entry.answer,
                tier: 'tier1',
                suggestions: generateSuggestions(content),
                thinkingSteps: steps,
              })
              
              set({ isTyping: false, abortController: null })
              usedCache = true
              return
            }
            
            // No direct cache hit - check for references to previous results
            const { hasReferences, patterns } = detectReferences(content)
            
            if (hasReferences) {
              // Get recent knowledge entries for context injection
              const recentEntries = await getAllKnowledgeEntries()
              const relevantContext = await findRelevantContext(content, recentEntries)
              
              if (relevantContext) {
                enrichedContent = injectPreviousContext(content, relevantContext)
                steps[0] = {
                  ...steps[0],
                  status: 'complete',
                  duration: Date.now() - cacheStart,
                  thinking: `Detected references (${patterns.join(', ')}), adding context from previous query...`,
                  expandable: {
                    input: `Reference patterns: ${patterns.join(', ')}`,
                    output: `Injecting context from: "${relevantContext.question}"`
                  }
                }
              } else {
                steps[0] = {
                  ...steps[0],
                  status: 'complete',
                  duration: Date.now() - cacheStart,
                  thinking: 'No matching cached answers, proceeding with fresh analysis...'
                }
              }
            } else {
              steps[0] = {
                ...steps[0],
                status: 'complete',
                duration: Date.now() - cacheStart,
                thinking: 'No cached answer found, proceeding with analysis...'
              }
            }
            updateSteps(steps)
          } catch (cacheError) {
            console.warn('Knowledge base check failed:', cacheError)
            steps[0] = {
              ...steps[0],
              status: 'complete',
              duration: Date.now() - cacheStart,
              thinking: 'Proceeding with analysis...'
            }
            updateSteps(steps)
          }
          
          // Skip the rest if we used cache
          if (usedCache) return
          
          // Build conversation history with analysis results (use enriched content)
          const historyStr = messages.slice(-6).map(m => {
            if (m.role === 'assistant' && m.executionResult?.result) {
              return `Navs: [Computed: ${JSON.stringify(m.executionResult.result)}] ${m.content}`
            }
            return `${m.role === 'user' ? 'User' : 'Navs'}: ${m.content}`
          }).join('\n\n')
          
          // =================================================================
          // STEP 1: Analyzing the question
          // =================================================================
          const step1Index = steps.length
          const step1 = createStep('analyzing', 'Looking at your question...', {
            thinking: analyzeQuestion(enrichedContent)
          })
          steps.push(step1)
          updateSteps(steps)
          
          await new Promise(r => setTimeout(r, 100))
          steps[step1Index] = { ...steps[step1Index], status: 'complete', duration: 100 }
          updateSteps(steps)
          
          // Check if aborted
          if (abortController.signal.aborted) throw new DOMException('Stopped', 'AbortError')
          
          // =================================================================
          // STEP 2: Try Tier 1 (Context-based)
          // =================================================================
          const step2Index = steps.length
          const step2 = createStep('searchingContext', 'Checking my summary data...', {
            thinking: 'Looking through NTR breakdown, enrollment counts, category performance...'
          })
          steps.push(step2)
          updateSteps(steps)
          
          const tier1Start = Date.now()
          let tier1Response: string = ''
          let tier1Parsed
          let useTier2 = false
          let tier1Reasoning: string | undefined
          
          try {
            // Use enriched content (with injected context if references detected)
            const tier1Prompt = buildTier1Prompt(enrichedContent, context, historyStr)
            const rawResponse = await generateWithProvider(tier1Prompt, provider, model, abortController.signal)
            
            // Extract R1 reasoning if applicable
            if (isR1Model) {
              const parsed = extractR1Reasoning(rawResponse)
              tier1Reasoning = parsed.reasoning
              tier1Response = parsed.content
            } else {
              tier1Response = rawResponse
            }
            
            tier1Parsed = parseTier1Response(tier1Response)
            useTier2 = needsTier2Fallback(tier1Parsed)
            
            const thinking = tier1Parsed?.canAnswer 
              ? `Found what you need in my pre-calculated data...`
              : tier1Parsed?.reason || `This needs a deeper look into the raw records...`
            
            steps[step2Index] = { 
              ...steps[step2Index], 
              status: 'complete', 
              duration: Date.now() - tier1Start,
              thinking,
              expandable: tier1Reasoning ? { llmReasoning: tier1Reasoning } : undefined
            }
            updateSteps(steps)
          } catch (error) {
            if (isAbortError(error)) throw error
            console.error('Tier 1 error:', error)
            useTier2 = true
            steps[step2Index] = { 
              ...steps[step2Index], 
              status: 'error', 
              duration: Date.now() - tier1Start,
              thinking: 'Context search had an issue, switching to data analysis...'
            }
            updateSteps(steps)
          }
          
          // =================================================================
          // TIER 1 SUCCESS - Use context answer
          // =================================================================
          if (!useTier2 && tier1Parsed?.canAnswer && tier1Parsed.answer) {
            const step3 = createStep('foundInContext', 'Got it from the summary!', {
              thinking: 'The answer was in my pre-aggregated data.'
            })
            step3.status = 'complete'
            step3.duration = 0
            steps.push(step3)
            
            const stepComplete = createStep('complete', 'Done!')
            stepComplete.status = 'complete'
            steps.push(stepComplete)
            updateSteps(steps)
            
            updateMessage(assistantMsgId, {
              content: tier1Parsed.answer,
              tier: 'tier1',
              suggestions: generateSuggestions(content),
              thinkingSteps: steps,
            })
            
            set({ isTyping: false, abortController: null })
            return
          }
          
          // Check if aborted
          if (abortController.signal.aborted) throw new DOMException('Stopped', 'AbortError')
          
          // =================================================================
          // TIER 2: Code Execution Fallback
          // =================================================================
          const step3 = createStep('needsDeepDive', 'Need to dig into the raw records...', {
            thinking: tier1Parsed?.reason || 'This requires filtering and analyzing individual student records...'
          })
          step3.status = 'complete'
          step3.duration = 0
          steps.push(step3)
          updateSteps(steps)
          
          // Step 4: Generate code
          const step4Index = steps.length
          const step4 = createStep('generatingCode', 'Writing analysis code...', {
            thinking: 'Let me write some code to filter and calculate this...'
          })
          steps.push(step4)
          updateSteps(steps)
          
          const tier2Start = Date.now()
          let generatedCode: string | null = null
          let tier2Reasoning: string | undefined
          
          try {
            // Use enriched content (with injected context if references detected)
            const tier2Prompt = buildTier2Prompt(enrichedContent)
            const rawResponse = await generateWithProvider(tier2Prompt, provider, model, abortController.signal)
            
            // Extract R1 reasoning if applicable
            if (isR1Model) {
              const parsed = extractR1Reasoning(rawResponse)
              tier2Reasoning = parsed.reasoning
              generatedCode = extractCodeBlock(parsed.content)
              
              // Generate thinking summary from R1 reasoning
              const thinkingSummary = tier2Reasoning 
                ? generateThinkingSummary(tier2Reasoning)
                : 'Generated analysis code...'
              
              steps[step4Index] = {
                ...steps[step4Index],
                thinking: thinkingSummary
              }
            } else {
              generatedCode = extractCodeBlock(rawResponse)
            }
            
            steps[step4Index] = {
              ...steps[step4Index],
              status: 'complete',
              duration: Date.now() - tier2Start,
              thinking: steps[step4Index].thinking || 'Generated the analysis code...',
              expandable: {
                code: generatedCode || 'No code extracted',
                llmReasoning: tier2Reasoning
              }
            }
            updateSteps(steps)
          } catch (error) {
            if (isAbortError(error)) throw error
            console.error('Code generation error:', error)
            steps[step4Index] = {
              ...steps[step4Index],
              status: 'error',
              duration: Date.now() - tier2Start,
              thinking: 'Failed to generate analysis code...',
              expandable: { error: String(error) }
            }
            updateSteps(steps)
            throw new Error(ERROR_MESSAGES.tier2CodeError(String(error)))
          }
          
          if (!generatedCode) {
            throw new Error('AI did not generate executable code')
          }
          
          // Validate code
          const validation = validateCode(generatedCode)
          if (!validation.valid) {
            throw new Error(`Code validation failed: ${validation.reason}`)
          }
          
          // Check if aborted
          if (abortController.signal.aborted) throw new DOMException('Stopped', 'AbortError')
          
          // Step 5: Execute code
          const step5Index = steps.length
          const step5 = createStep('executingCode', `Running against ${students.length.toLocaleString()} records...`, {
            thinking: 'Executing the analysis code against all student records...'
          })
          steps.push(step5)
          updateSteps(steps)
          
          const execStart = Date.now()
          const execResult = executeInSandbox(generatedCode, students as StudentRecord[])
          
          const resultAnswer = execResult.result?.answer
          const resultExplanation = (execResult.result as { explanation?: string })?.explanation
          
          // Check for empty/undefined results
          const isEmptyResult = resultAnswer === undefined || resultAnswer === null || 
            (typeof resultAnswer === 'object' && Object.keys(resultAnswer as object).length === 0) ||
            (Array.isArray(resultAnswer) && resultAnswer.length === 0)
          
          steps[step5Index] = {
            ...steps[step5Index],
            status: execResult.success && !isEmptyResult ? 'complete' : 'error',
            duration: Date.now() - execStart,
            thinking: !execResult.success 
              ? `Error: ${execResult.error}`
              : isEmptyResult
                ? 'Analysis completed but found no matching data for this query.'
                : `Found the answer: ${JSON.stringify(resultAnswer)}`,
            expandable: {
              input: `Analyzed ${students.length.toLocaleString()} student records`,
              output: execResult.success 
                ? JSON.stringify(execResult.result, null, 2)
                : undefined,
              error: !execResult.success ? execResult.error : (isEmptyResult ? 'No matching data found' : undefined)
            }
          }
          updateSteps(steps)
          
          if (!execResult.success) {
            throw new Error(ERROR_MESSAGES.tier2CodeError(execResult.error || 'Unknown error'))
          }
          
          // Handle empty results gracefully - continue but note the issue
          if (isEmptyResult) {
            console.warn('[Navs] Code execution returned empty result:', resultAnswer)
          }
          
          // Save to analysis cache
          set((state) => ({
            analysisCache: [
              ...state.analysisCache.slice(-9), // Keep last 10
              {
                question: content,
                answer: resultAnswer,
                explanation: resultExplanation,
                code: generatedCode!,
                timestamp: new Date()
              }
            ]
          }))
          
          // Check if aborted
          if (abortController.signal.aborted) throw new DOMException('Stopped', 'AbortError')
          
          // Step 6: Format result
          const step6Index = steps.length
          const step6 = createStep('formattingResult', 'Putting it together...', {
            thinking: 'Formatting the result into a clear answer...'
          })
          steps.push(step6)
          updateSteps(steps)
          
          const formatStart = Date.now()
          let finalResponse: string
          let formatReasoning: string | undefined
          
          try {
            const formatPrompt = buildFormattingPrompt(
              content,
              execResult.result as { answer: unknown; explanation?: string },
              context.slice(0, 2000)
            )
            const rawResponse = await generateWithProvider(formatPrompt, provider, model, abortController.signal)
            
            if (isR1Model) {
              const parsed = extractR1Reasoning(rawResponse)
              formatReasoning = parsed.reasoning
              finalResponse = parsed.content
            } else {
              finalResponse = rawResponse
            }
            
            steps[step6Index] = {
              ...steps[step6Index],
              status: 'complete',
              duration: Date.now() - formatStart,
              thinking: 'Formatted the response!',
              expandable: formatReasoning ? { llmReasoning: formatReasoning } : undefined
            }
            updateSteps(steps)
          } catch (error) {
            if (isAbortError(error)) throw error
            // If formatting fails, use a simple response
            const result = execResult.result as { answer: unknown; explanation?: string }
            finalResponse = `Based on my analysis: **${JSON.stringify(result?.answer)}**\n\n${result?.explanation || ''}`
            
            steps[step6Index] = {
              ...steps[step6Index],
              status: 'complete',
              duration: Date.now() - formatStart,
              thinking: 'Used simplified formatting.'
            }
            updateSteps(steps)
          }
          
          // Ensure all previous steps are marked complete before "Done!"
          steps.forEach((s, i) => {
            if (s.status === 'active') {
              steps[i] = { ...s, status: 'complete' as const, duration: s.duration || 0 }
            }
          })
          updateSteps(steps)
          
          // Step 7: Complete
          const step7 = createStep('complete', 'Done!')
          step7.status = 'complete'
          steps.push(step7)
          updateSteps(steps)
          
          // Update message with final answer
          updateMessage(assistantMsgId, {
            content: finalResponse,
            tier: 'tier2',
            executedCode: generatedCode,
            executionResult: {
              success: execResult.success,
              result: execResult.result,
              duration: execResult.executionTime,
            },
            suggestions: generateSuggestions(content),
            thinkingSteps: steps,
          })
          
          // =================================================================
          // KNOWLEDGE BASE: Store result and run follow-up pre-computation
          // =================================================================
          const execResultTyped = execResult.result as { answer: unknown; explanation?: string }
          
          // Build computed data for knowledge base
          const computedData: ComputedData = inferComputedData(content, execResultTyped)
          
          // Store in knowledge base (async, don't block)
          generateEmbedding(content).then(async (embedding) => {
            if (embedding.length > 0) {
              try {
                await addKnowledgeEntry({
                  question: content,
                  answer: finalResponse,
                  computedData,
                  embedding
                })
                console.log('[Navs] Stored answer in knowledge base')
              } catch (e) {
                console.warn('[Navs] Failed to store in knowledge base:', e)
              }
            }
          })
          
          // Run follow-up pre-computation in background
          runBackgroundPrecomputation(
            content,
            finalResponse,
            computedData,
            students,
            async (question: string, _context: unknown) => {
              // This is a simplified compute function for follow-ups
              // It re-uses the code generation and execution flow
              const prompt = buildTier2Prompt(question)
              const response = await generateWithProvider(prompt, provider, model)
              const code = extractCodeBlock(response)
              if (!code) throw new Error('No code generated')
              const result = executeInSandbox(code, students as StudentRecord[])
              if (!result.success) throw new Error(result.error)
              const typedResult = result.result as { answer: unknown; explanation?: string }
              return {
                answer: String(typedResult.answer),
                computedData: inferComputedData(question, typedResult),
                code
              }
            },
            model
          )
          
        } catch (error) {
          console.error('Send message error:', error)
          
          // Handle abort
          if (isAbortError(error)) {
            const stoppedStep = createStep('stopped', 'Stopped by user')
            stoppedStep.status = 'stopped'
            steps.push(stoppedStep)
            updateSteps(steps)
            
            updateMessage(assistantMsgId, {
              content: 'Generation stopped.',
              thinkingSteps: steps,
            })
            
            set({ isTyping: false, abortController: null })
            return
          }
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          
          // Add error step
          const errorStep = createStep('error', 'Ran into an issue...', {
            thinking: errorMessage,
            expandable: { error: errorMessage }
          })
          errorStep.status = 'error'
          steps.push(errorStep)
          updateSteps(steps)
          
          // Check if it's a configuration error
          if (errorMessage.includes('API_KEY') || errorMessage.includes('not configured')) {
            updateMessage(assistantMsgId, {
              content: `**Configuration needed:** ${errorMessage}\n\nTo enable AI responses, please create a \`.env\` file in the iris-react directory with:\n\n\`\`\`\nVITE_GEMINI_API_KEY=your_api_key_here\n\`\`\`\n\nYou can get a free API key from [Google AI Studio](https://aistudio.google.com/).`,
              thinkingSteps: steps,
            })
          } else {
            updateMessage(assistantMsgId, {
              content: ERROR_MESSAGES.apiError,
              thinkingSteps: steps,
            })
          }
        } finally {
          set({ isTyping: false, abortController: null })
        }
      },
    }),
    {
      name: 'navs-storage',
      partialize: (state) => ({
        messages: state.messages.slice(-50),
        provider: state.provider,
        model: state.model,
        conversationSummary: state.conversationSummary,
        analysisCache: state.analysisCache.slice(-10),
      }),
    }
  )
)
