/**
 * Follow-up Engine
 * Predicts likely follow-up questions and pre-computes answers in parallel
 */

import { generateWithProvider } from './llm-provider'
import { addKnowledgeEntry, type ComputedData } from './indexed-db'
import { generateEmbedding } from './llm-provider'

// =============================================================================
// TYPES
// =============================================================================

export interface FollowUpPrediction {
  question: string
  priority: 'high' | 'medium' | 'low'
  category: string
}

export interface PrecomputedResult {
  question: string
  answer: string
  computedData: ComputedData
  embedding: number[]
  success: boolean
  error?: string
  duration: number
}

export interface PrecomputationStatus {
  total: number
  completed: number
  successful: number
  failed: number
  inProgress: boolean
}

// =============================================================================
// FOLLOW-UP PREDICTION
// =============================================================================

/**
 * Common follow-up patterns based on question types
 */
const FOLLOW_UP_TEMPLATES: Record<string, string[]> = {
  list: [
    'breakdown by program',
    'trend over years',
    'comparison with last year',
    'details for top 3',
    'filter by category'
  ],
  aggregation: [
    'breakdown by state',
    'breakdown by school',
    'breakdown by program',
    'comparison over time',
    'percentage distribution'
  ],
  comparison: [
    'what changed',
    'why the difference',
    'trend analysis',
    'detailed breakdown'
  ],
  count: [
    'breakdown by category',
    'comparison with previous period',
    'percentage of total',
    'trend over time'
  ]
}

/**
 * Generate follow-up questions based on the original question and result
 */
export async function predictFollowUps(
  question: string,
  answer: string,
  computedData: ComputedData,
  model: string
): Promise<FollowUpPrediction[]> {
  // Start with template-based predictions
  const templatePredictions = generateTemplatePredictions(question, computedData)
  
  // Also use LLM to generate contextual follow-ups
  const llmPredictions = await generateLLMPredictions(question, answer, computedData, model)
  
  // Combine and deduplicate
  const allPredictions = [...templatePredictions, ...llmPredictions]
  const unique = deduplicatePredictions(allPredictions)
  
  return unique.slice(0, 5) // Max 5 follow-ups
}

/**
 * Generate follow-ups based on templates and computed data type
 */
function generateTemplatePredictions(
  question: string,
  computedData: ComputedData
): FollowUpPrediction[] {
  const templates = FOLLOW_UP_TEMPLATES[computedData.type] || FOLLOW_UP_TEMPLATES.count
  const predictions: FollowUpPrediction[] = []
  
  // Generate contextual follow-ups
  const entities = computedData.entities || []
  
  for (const template of templates.slice(0, 3)) {
    predictions.push({
      question: `${template} for the above`,
      priority: 'medium',
      category: template
    })
  }
  
  // Add entity-specific follow-ups
  if (entities.length > 0) {
    predictions.push({
      question: `More details about ${entities[0]}`,
      priority: 'high',
      category: 'detail'
    })
    
    if (entities.length >= 3) {
      predictions.push({
        question: `How many in the top 3 ${getEntityType(question)}`,
        priority: 'high',
        category: 'aggregation'
      })
    }
  }
  
  return predictions
}

/**
 * Use LLM to generate contextual follow-up predictions
 */
async function generateLLMPredictions(
  question: string,
  answer: string,
  computedData: ComputedData,
  model: string
): Promise<FollowUpPrediction[]> {
  try {
    const prompt = `Given this enrollment data Q&A, predict 3 likely follow-up questions the user might ask.

Question: ${question}
Answer: ${answer.slice(0, 500)}
Data type: ${computedData.type}
Entities found: ${computedData.entities?.slice(0, 5).join(', ') || 'none'}

Return ONLY the questions, one per line. No numbering, no explanations.`

    const response = await generateWithProvider(prompt, 'ollama', model)
    
    const lines = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 5 && line.length < 200)
      .filter(line => !line.startsWith('-') && !line.match(/^\d+\./))
      .slice(0, 3)
    
    return lines.map((question, i) => ({
      question,
      priority: i === 0 ? 'high' : 'medium' as const,
      category: 'llm-generated'
    }))
  } catch (error) {
    console.warn('[Follow-up Engine] LLM prediction failed:', error)
    return []
  }
}

/**
 * Extract entity type from question (states, programs, schools, etc.)
 */
function getEntityType(question: string): string {
  const lower = question.toLowerCase()
  if (lower.includes('state')) return 'states'
  if (lower.includes('program')) return 'programs'
  if (lower.includes('school')) return 'schools'
  if (lower.includes('categor')) return 'categories'
  if (lower.includes('student')) return 'students'
  return 'items'
}

/**
 * Remove duplicate or very similar predictions
 */
function deduplicatePredictions(predictions: FollowUpPrediction[]): FollowUpPrediction[] {
  const seen = new Set<string>()
  const unique: FollowUpPrediction[] = []
  
  for (const pred of predictions) {
    const normalized = pred.question.toLowerCase().replace(/[^\w\s]/g, '')
    const words = normalized.split(/\s+/).slice(0, 4).join(' ')
    
    if (!seen.has(words)) {
      seen.add(words)
      unique.push(pred)
    }
  }
  
  return unique
}

// =============================================================================
// PARALLEL PRE-COMPUTATION
// =============================================================================

// Track active pre-computation
let precomputationStatus: PrecomputationStatus = {
  total: 0,
  completed: 0,
  successful: 0,
  failed: 0,
  inProgress: false
}

export function getPrecomputationStatus(): PrecomputationStatus {
  return { ...precomputationStatus }
}

/**
 * Pre-compute answers for predicted follow-ups in PARALLEL
 * This runs in the background after the main answer is shown
 */
export async function precomputeFollowUps(
  followUps: FollowUpPrediction[],
  originalContext: {
    question: string
    computedData: ComputedData
    students: unknown[]
  },
  computeAnswer: (question: string, context: unknown) => Promise<{
    answer: string
    computedData: ComputedData
    code?: string
  }>,
  _model: string
): Promise<PrecomputedResult[]> {
  if (followUps.length === 0) {
    return []
  }
  
  // Update status
  precomputationStatus = {
    total: followUps.length,
    completed: 0,
    successful: 0,
    failed: 0,
    inProgress: true
  }
  
  console.log(`[Follow-up Engine] Pre-computing ${followUps.length} follow-ups in parallel...`)
  
  // Create context string for follow-ups
  const contextStr = `
Based on previous query: "${originalContext.question}"
Entities: ${originalContext.computedData.entities?.join(', ') || 'none'}
Values: ${JSON.stringify(originalContext.computedData.values || {}).slice(0, 500)}
`
  
  // Run ALL computations in PARALLEL
  const results = await Promise.all(
    followUps.map(async (followUp): Promise<PrecomputedResult> => {
      const startTime = performance.now()
      
      try {
        // Add context to the follow-up question
        const enrichedQuestion = `${followUp.question}\n\n[Context: ${contextStr}]`
        
        // Compute the answer
        const result = await computeAnswer(enrichedQuestion, originalContext.students)
        
        // Generate embedding
        const embedding = await generateEmbedding(followUp.question)
        
        // Store in knowledge base
        await addKnowledgeEntry({
          question: followUp.question,
          answer: result.answer,
          computedData: result.computedData,
          embedding
        })
        
        precomputationStatus.completed++
        precomputationStatus.successful++
        
        console.log(`[Follow-up Engine] Pre-computed: "${followUp.question.slice(0, 50)}..."`)
        
        return {
          question: followUp.question,
          answer: result.answer,
          computedData: result.computedData,
          embedding,
          success: true,
          duration: performance.now() - startTime
        }
      } catch (error) {
        precomputationStatus.completed++
        precomputationStatus.failed++
        
        console.warn(`[Follow-up Engine] Failed to pre-compute: "${followUp.question}"`, error)
        
        return {
          question: followUp.question,
          answer: '',
          computedData: { type: 'unknown', entities: [], values: {} },
          embedding: [],
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: performance.now() - startTime
        }
      }
    })
  )
  
  precomputationStatus.inProgress = false
  
  const successful = results.filter(r => r.success).length
  console.log(`[Follow-up Engine] Pre-computation complete: ${successful}/${followUps.length} successful`)
  
  return results
}

// =============================================================================
// BACKGROUND PROCESSOR
// =============================================================================

/**
 * Run follow-up prediction and pre-computation in background
 * Returns immediately after starting the background process
 */
export function runBackgroundPrecomputation(
  question: string,
  answer: string,
  computedData: ComputedData,
  students: unknown[],
  computeAnswer: (question: string, context: unknown) => Promise<{
    answer: string
    computedData: ComputedData
    code?: string
  }>,
  model: string
): void {
  // Run async without blocking
  (async () => {
    try {
      // Predict follow-ups
      const followUps = await predictFollowUps(question, answer, computedData, model)
      
      if (followUps.length === 0) {
        console.log('[Follow-up Engine] No follow-ups predicted')
        return
      }
      
      console.log(`[Follow-up Engine] Predicted ${followUps.length} follow-ups:`, 
        followUps.map(f => f.question.slice(0, 40)))
      
      // Pre-compute in parallel
      await precomputeFollowUps(
        followUps,
        { question, computedData, students },
        computeAnswer,
        model
      )
    } catch (error) {
      console.error('[Follow-up Engine] Background pre-computation failed:', error)
    }
  })()
}
